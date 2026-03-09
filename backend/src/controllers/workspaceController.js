const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { cache } = require('../config/redis');

const getWorkspace = async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `SELECT w.*, u.name as owner_name,
            json_agg(json_build_object(
              'user_id', wm.user_id, 'role', wm.role,
              'name', u2.name, 'email', u2.email
            )) as members
     FROM workspaces w
     JOIN users u ON u.id = w.owner_id
     LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
     LEFT JOIN users u2 ON u2.id = wm.user_id
     WHERE w.id = $1
     GROUP BY w.id, u.name`,
    [id]
  );

  if (!result.rows.length) return res.status(404).json({ error: 'Workspace not found' });
  res.json(result.rows[0]);
};

const createWorkspace = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const id = uuidv4();
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + id.slice(0, 8);

  const client = await require('../config/database').getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO workspaces (id, owner_id, name, slug) VALUES ($1, $2, $3, $4)',
      [id, req.user.id, name, slug]
    );
    await client.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [id, req.user.id, 'owner']
    );
    await client.query('COMMIT');
    res.status(201).json({ id, name, slug });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const updateWorkspace = async (req, res) => {
  const { id } = req.params;
  const { name, settings } = req.body;

  const ownerCheck = await query('SELECT id FROM workspaces WHERE id = $1 AND owner_id = $2', [id, req.user.id]);
  if (!ownerCheck.rows.length) return res.status(403).json({ error: 'Only owner can update workspace' });

  const updates = [];
  const values = [];
  let idx = 1;
  if (name) { updates.push(`name = $${idx++}`); values.push(name); }
  if (settings) { updates.push(`settings = $${idx++}`); values.push(JSON.stringify(settings)); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  values.push(id);
  const result = await query(
    `UPDATE workspaces SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  res.json(result.rows[0]);
};

const inviteMember = async (req, res) => {
  const { id } = req.params;
  const { email, role = 'viewer' } = req.body;

  const ownerCheck = await query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [id, req.user.id]
  );
  if (!ownerCheck.rows.length || ownerCheck.rows[0].role === 'viewer') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });

  const targetUserId = userResult.rows[0].id;
  const existing = await query(
    'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [id, targetUserId]
  );
  if (existing.rows.length) return res.status(409).json({ error: 'User already a member' });

  await query(
    'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
    [id, targetUserId, role]
  );

  res.json({ message: 'Member invited successfully' });
};

const removeMember = async (req, res) => {
  const { id, userId } = req.params;

  const ownerCheck = await query('SELECT id FROM workspaces WHERE id = $1 AND owner_id = $2', [id, req.user.id]);
  if (!ownerCheck.rows.length) return res.status(403).json({ error: 'Only owner can remove members' });

  if (userId === req.user.id) return res.status(400).json({ error: 'Owner cannot remove themselves' });

  await query('DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [id, userId]);
  res.json({ message: 'Member removed' });
};

const getWorkspaceStats = async (req, res) => {
  const { id } = req.params;

  const [datasetCount, dashboardCount, memberCount] = await Promise.all([
    query('SELECT COUNT(*) FROM datasets WHERE workspace_id = $1', [id]),
    query('SELECT COUNT(*) FROM dashboards WHERE workspace_id = $1', [id]),
    query('SELECT COUNT(*) FROM workspace_members WHERE workspace_id = $1', [id]),
  ]);

  res.json({
    datasets: parseInt(datasetCount.rows[0].count),
    dashboards: parseInt(dashboardCount.rows[0].count),
    members: parseInt(memberCount.rows[0].count),
  });
};

module.exports = { getWorkspace, createWorkspace, updateWorkspace, inviteMember, removeMember, getWorkspaceStats };
