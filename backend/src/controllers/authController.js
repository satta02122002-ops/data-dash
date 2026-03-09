const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = uuidv4();
  return { accessToken, refreshToken };
};

const register = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + userId.slice(0, 8);

  const client = await query('BEGIN');

  try {
    // Create user
    const userResult = await query(
      `INSERT INTO users (id, email, password_hash, name, is_verified)
       VALUES ($1, $2, $3, $4, true) RETURNING id, email, name, plan, avatar_url`,
      [userId, email.toLowerCase(), passwordHash, name]
    );
    const user = userResult.rows[0];

    // Create default workspace
    const workspaceId = uuidv4();
    await query(
      `INSERT INTO workspaces (id, owner_id, name, slug)
       VALUES ($1, $2, $3, $4)`,
      [workspaceId, userId, `${name}'s Workspace`, slug]
    );

    // Add owner to workspace members
    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [workspaceId, userId]
    );

    await query('COMMIT');

    const { accessToken, refreshToken } = generateTokens(userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [userId, refreshToken, expiresAt]
    );

    logger.info('User registered:', { userId, email });

    res.status(201).json({
      user: { ...user, defaultWorkspaceId: workspaceId },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const result = await query(
    `SELECT u.*, w.id as default_workspace_id
     FROM users u
     LEFT JOIN workspaces w ON w.owner_id = u.id
     WHERE u.email = $1
     ORDER BY w.created_at ASC
     LIMIT 1`,
    [email.toLowerCase()]
  );

  if (!result.rows.length) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const { accessToken, refreshToken } = generateTokens(user.id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [user.id, refreshToken, expiresAt]
  );

  // Cache user
  const userData = {
    id: user.id, email: user.email, name: user.name,
    plan: user.plan, avatar_url: user.avatar_url, is_verified: user.is_verified,
  };
  await cache.set(`user:${user.id}`, userData, 300);

  logger.info('User logged in:', { userId: user.id });

  res.json({
    user: { ...userData, defaultWorkspaceId: user.default_workspace_id },
    accessToken,
    refreshToken,
  });
};

const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) return res.status(400).json({ error: 'Refresh token required' });

  const result = await query(
    `SELECT rt.*, u.id as user_id, u.email, u.name, u.plan
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token = $1 AND rt.expires_at > NOW()`,
    [token]
  );

  if (!result.rows.length) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const { user_id, id: tokenId } = result.rows[0];

  // Rotate refresh token
  await query('DELETE FROM refresh_tokens WHERE id = $1', [tokenId]);

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user_id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [user_id, newRefreshToken, expiresAt]
  );

  res.json({ accessToken, refreshToken: newRefreshToken });
};

const logout = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (token) {
    // Blacklist the access token until it expires
    try {
      const decoded = jwt.decode(token);
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await cache.set(`blacklist:${token}`, true, ttl);
    } catch (_) {}
  }

  const { refreshToken: rToken } = req.body;
  if (rToken) {
    await query('DELETE FROM refresh_tokens WHERE token = $1', [rToken]);
  }

  await cache.del(`user:${req.user.id}`);

  res.json({ message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  const result = await query(
    `SELECT u.id, u.email, u.name, u.plan, u.avatar_url, u.created_at,
            json_agg(json_build_object('id', w.id, 'name', w.name, 'slug', w.slug, 'role', wm.role)) as workspaces
     FROM users u
     LEFT JOIN workspace_members wm ON wm.user_id = u.id
     LEFT JOIN workspaces w ON w.id = wm.workspace_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [req.user.id]
  );

  res.json(result.rows[0]);
};

const updateProfile = async (req, res) => {
  const { name } = req.body;
  const updates = [];
  const values = [];
  let idx = 1;

  if (name) { updates.push(`name = $${idx++}`); values.push(name); }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.user.id);
  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, plan, avatar_url`,
    values
  );

  await cache.del(`user:${req.user.id}`);
  res.json(result.rows[0]);
};

module.exports = { register, login, refreshToken, logout, getMe, updateProfile };
