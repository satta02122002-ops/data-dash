const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { cache } = require('../config/redis');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Check token blacklist
    const blacklisted = await cache.get(`blacklist:${token}`);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from cache or DB
    let user = await cache.get(`user:${decoded.userId}`);
    if (!user) {
      const result = await query(
        'SELECT id, email, name, plan, avatar_url, is_verified FROM users WHERE id = $1',
        [decoded.userId]
      );
      if (!result.rows.length) {
        return res.status(401).json({ error: 'User not found' });
      }
      user = result.rows[0];
      await cache.set(`user:${decoded.userId}`, user, 300);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireWorkspaceAccess = (minRole = 'viewer') => async (req, res, next) => {
  try {
    const workspaceId = req.params.workspaceId || req.body.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'Workspace ID required' });

    const result = await query(
      `SELECT wm.role FROM workspace_members wm
       WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
      [workspaceId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(403).json({ error: 'Access denied to workspace' });
    }

    const roleHierarchy = { viewer: 0, editor: 1, owner: 2 };
    const userRole = result.rows[0].role;
    if (roleHierarchy[userRole] < roleHierarchy[minRole]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.workspaceRole = userRole;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, requireWorkspaceAccess };
