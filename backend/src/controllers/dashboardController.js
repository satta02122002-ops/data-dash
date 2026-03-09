const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

// Create dashboard
const createDashboard = async (req, res) => {
  const { workspaceId, datasetId, name, description, theme = 'light' } = req.body;

  if (!workspaceId || !name) {
    return res.status(400).json({ error: 'workspaceId and name are required' });
  }

  const wsCheck = await query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, req.user.id]
  );
  if (!wsCheck.rows.length) {
    return res.status(403).json({ error: 'Access denied to workspace' });
  }

  const id = uuidv4();
  const result = await query(
    `INSERT INTO dashboards (id, workspace_id, user_id, dataset_id, name, description, theme)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, workspaceId, req.user.id, datasetId || null, name, description || null, theme]
  );

  logger.info('Dashboard created:', { dashboardId: id, userId: req.user.id });
  res.status(201).json(result.rows[0]);
};

// Get all dashboards for workspace
const getDashboards = async (req, res) => {
  const { workspaceId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const result = await query(
    `SELECT d.id, d.name, d.description, d.theme, d.is_public, d.thumbnail_url,
            d.created_at, d.updated_at,
            u.name as created_by,
            ds.name as dataset_name,
            (SELECT COUNT(*) FROM widgets w WHERE w.dashboard_id = d.id) as widget_count
     FROM dashboards d
     JOIN users u ON u.id = d.user_id
     LEFT JOIN datasets ds ON ds.id = d.dataset_id
     WHERE d.workspace_id = $1
     ORDER BY d.updated_at DESC
     LIMIT $2 OFFSET $3`,
    [workspaceId, limit, offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) FROM dashboards WHERE workspace_id = $1',
    [workspaceId]
  );

  res.json({
    dashboards: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: parseInt(page),
    limit: parseInt(limit),
  });
};

// Get single dashboard with widgets
const getDashboard = async (req, res) => {
  const { id } = req.params;

  const cacheKey = `dashboard:${id}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const dashResult = await query(
    `SELECT d.*, ds.name as dataset_name, ds.columns_metadata, ds.file_type,
            ds.file_path, ds.cleaned_file_path,
            u.name as created_by
     FROM dashboards d
     LEFT JOIN datasets ds ON ds.id = d.dataset_id
     JOIN users u ON u.id = d.user_id
     WHERE d.id = $1`,
    [id]
  );

  if (!dashResult.rows.length) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  const widgetResult = await query(
    'SELECT * FROM widgets WHERE dashboard_id = $1 ORDER BY created_at',
    [id]
  );

  const dashboard = {
    ...dashResult.rows[0],
    widgets: widgetResult.rows,
  };

  await cache.set(cacheKey, dashboard, 60);
  res.json(dashboard);
};

// Get public dashboard (no auth)
const getPublicDashboard = async (req, res) => {
  const { shareToken } = req.params;

  const result = await query(
    `SELECT d.*, ds.name as dataset_name, ds.columns_metadata,
            ds.file_path, ds.cleaned_file_path
     FROM dashboards d
     LEFT JOIN datasets ds ON ds.id = d.dataset_id
     WHERE d.share_token = $1 AND d.is_public = true`,
    [shareToken]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Dashboard not found or not public' });
  }

  const widgetResult = await query(
    'SELECT * FROM widgets WHERE dashboard_id = $1',
    [result.rows[0].id]
  );

  res.json({ ...result.rows[0], widgets: widgetResult.rows });
};

// Update dashboard
const updateDashboard = async (req, res) => {
  const { id } = req.params;
  const { name, description, layout, filters, theme } = req.body;

  const existing = await query(
    'SELECT * FROM dashboards WHERE id = $1 AND user_id = $2',
    [id, req.user.id]
  );
  if (!existing.rows.length) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
  if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
  if (layout !== undefined) { updates.push(`layout = $${idx++}`); values.push(JSON.stringify(layout)); }
  if (filters !== undefined) { updates.push(`filters = $${idx++}`); values.push(JSON.stringify(filters)); }
  if (theme !== undefined) { updates.push(`theme = $${idx++}`); values.push(theme); }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  values.push(id);
  const result = await query(
    `UPDATE dashboards SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  await cache.del(`dashboard:${id}`);
  res.json(result.rows[0]);
};

// Share / unshare dashboard
const shareDashboard = async (req, res) => {
  const { id } = req.params;
  const { isPublic } = req.body;

  const existing = await query('SELECT * FROM dashboards WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Dashboard not found' });

  let shareToken = existing.rows[0].share_token;
  if (isPublic && !shareToken) {
    shareToken = uuidv4().replace(/-/g, '');
  }

  const result = await query(
    `UPDATE dashboards SET is_public = $1, share_token = $2 WHERE id = $3 RETURNING id, is_public, share_token`,
    [isPublic, isPublic ? shareToken : null, id]
  );

  await cache.del(`dashboard:${id}`);
  res.json(result.rows[0]);
};

// Delete dashboard
const deleteDashboard = async (req, res) => {
  const { id } = req.params;

  const result = await query(
    'DELETE FROM dashboards WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.user.id]
  );

  if (!result.rows.length) return res.status(404).json({ error: 'Dashboard not found' });

  await cache.del(`dashboard:${id}`);
  res.json({ message: 'Dashboard deleted' });
};

// Add widget
const addWidget = async (req, res) => {
  const { id: dashboardId } = req.params;
  const { type, title, config, position } = req.body;

  if (!type || !config) return res.status(400).json({ error: 'type and config are required' });

  const dashCheck = await query(
    'SELECT id FROM dashboards WHERE id = $1 AND user_id = $2',
    [dashboardId, req.user.id]
  );
  if (!dashCheck.rows.length) return res.status(404).json({ error: 'Dashboard not found' });

  const widgetId = uuidv4();
  const result = await query(
    `INSERT INTO widgets (id, dashboard_id, type, title, config, position)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [widgetId, dashboardId, type, title || null, JSON.stringify(config), JSON.stringify(position || { x: 0, y: 0, w: 4, h: 3 })]
  );

  await cache.del(`dashboard:${dashboardId}`);
  res.status(201).json(result.rows[0]);
};

// Update widget
const updateWidget = async (req, res) => {
  const { dashboardId, widgetId } = req.params;
  const { type, title, config, position } = req.body;

  const dashCheck = await query(
    'SELECT id FROM dashboards WHERE id = $1 AND user_id = $2',
    [dashboardId, req.user.id]
  );
  if (!dashCheck.rows.length) return res.status(404).json({ error: 'Dashboard not found' });

  const updates = [];
  const values = [];
  let idx = 1;

  if (type !== undefined) { updates.push(`type = $${idx++}`); values.push(type); }
  if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title); }
  if (config !== undefined) { updates.push(`config = $${idx++}`); values.push(JSON.stringify(config)); }
  if (position !== undefined) { updates.push(`position = $${idx++}`); values.push(JSON.stringify(position)); }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  values.push(widgetId, dashboardId);
  const result = await query(
    `UPDATE widgets SET ${updates.join(', ')} WHERE id = $${idx++} AND dashboard_id = $${idx} RETURNING *`,
    values
  );

  if (!result.rows.length) return res.status(404).json({ error: 'Widget not found' });

  await cache.del(`dashboard:${dashboardId}`);
  res.json(result.rows[0]);
};

// Delete widget
const deleteWidget = async (req, res) => {
  const { dashboardId, widgetId } = req.params;

  const dashCheck = await query('SELECT id FROM dashboards WHERE id = $1 AND user_id = $2', [dashboardId, req.user.id]);
  if (!dashCheck.rows.length) return res.status(404).json({ error: 'Dashboard not found' });

  await query('DELETE FROM widgets WHERE id = $1 AND dashboard_id = $2', [widgetId, dashboardId]);
  await cache.del(`dashboard:${dashboardId}`);
  res.json({ message: 'Widget deleted' });
};

// Bulk update widget positions (for drag & drop)
const updateWidgetPositions = async (req, res) => {
  const { id: dashboardId } = req.params;
  const { positions } = req.body; // [{ id, position }]

  const dashCheck = await query('SELECT id FROM dashboards WHERE id = $1 AND user_id = $2', [dashboardId, req.user.id]);
  if (!dashCheck.rows.length) return res.status(404).json({ error: 'Dashboard not found' });

  // Batch update
  for (const { id, position } of positions) {
    await query(
      'UPDATE widgets SET position = $1 WHERE id = $2 AND dashboard_id = $3',
      [JSON.stringify(position), id, dashboardId]
    );
  }

  await cache.del(`dashboard:${dashboardId}`);
  res.json({ message: 'Positions updated' });
};

module.exports = {
  createDashboard, getDashboards, getDashboard, getPublicDashboard,
  updateDashboard, shareDashboard, deleteDashboard,
  addWidget, updateWidget, deleteWidget, updateWidgetPositions,
};
