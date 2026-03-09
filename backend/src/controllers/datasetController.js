const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Upload dataset
const uploadDataset = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { workspaceId, name } = req.body;
  if (!workspaceId) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  // Verify workspace access
  const wsCheck = await query(
    `SELECT wm.role FROM workspace_members wm WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
    [workspaceId, req.user.id]
  );
  if (!wsCheck.rows.length) {
    fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Access denied to workspace' });
  }

  const datasetId = uuidv4();
  const datasetName = name || path.basename(req.file.originalname, path.extname(req.file.originalname));
  const fileType = path.extname(req.file.originalname).toLowerCase().replace('.', '');

  // Save dataset record
  await query(
    `INSERT INTO datasets (id, workspace_id, user_id, name, original_filename, file_path, file_size, file_type, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing')`,
    [datasetId, workspaceId, req.user.id, datasetName, req.file.originalname, req.file.path, req.file.size, fileType]
  );

  // Send to Python service for processing (async)
  procesDatasetAsync(datasetId, req.file.path, fileType);

  logger.info('Dataset uploaded:', { datasetId, userId: req.user.id });

  res.status(202).json({
    id: datasetId,
    name: datasetName,
    status: 'processing',
    message: 'File uploaded and being processed',
  });
};

const procesDatasetAsync = async (datasetId, filePath, fileType) => {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('file_type', fileType);
    formData.append('dataset_id', datasetId);

    const response = await axios.post(`${PYTHON_SERVICE_URL}/api/process`, formData, {
      headers: formData.getHeaders(),
      timeout: 300000, // 5 min
    });

    const { columns_metadata, row_count, column_count, cleaned_file_path, cleaning_report } = response.data;

    await query(
      `UPDATE datasets SET
        status = 'ready',
        columns_metadata = $1,
        row_count = $2,
        column_count = $3,
        cleaned_file_path = $4,
        cleaning_report = $5
       WHERE id = $6`,
      [
        JSON.stringify(columns_metadata),
        row_count,
        column_count,
        cleaned_file_path,
        JSON.stringify(cleaning_report),
        datasetId,
      ]
    );

    await cache.del(`dataset:${datasetId}`);
    logger.info('Dataset processed successfully:', { datasetId });
  } catch (err) {
    logger.error('Dataset processing failed:', { datasetId, error: err.message });
    await query(
      `UPDATE datasets SET status = 'error', error_message = $1 WHERE id = $2`,
      [err.message, datasetId]
    );
  }
};

// Get all datasets for workspace
const getDatasets = async (req, res) => {
  const { workspaceId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const result = await query(
    `SELECT d.id, d.name, d.original_filename, d.file_size, d.file_type,
            d.row_count, d.column_count, d.status, d.created_at, d.updated_at,
            u.name as uploaded_by
     FROM datasets d
     JOIN users u ON u.id = d.user_id
     WHERE d.workspace_id = $1
     ORDER BY d.created_at DESC
     LIMIT $2 OFFSET $3`,
    [workspaceId, limit, offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) FROM datasets WHERE workspace_id = $1',
    [workspaceId]
  );

  res.json({
    datasets: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: parseInt(page),
    limit: parseInt(limit),
  });
};

// Get single dataset
const getDataset = async (req, res) => {
  const { id } = req.params;

  const cached = await cache.get(`dataset:${id}`);
  if (cached) return res.json(cached);

  const result = await query(
    `SELECT d.*, u.name as uploaded_by
     FROM datasets d
     JOIN users u ON u.id = d.user_id
     WHERE d.id = $1`,
    [id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Dataset not found' });
  }

  const dataset = result.rows[0];
  if (dataset.status === 'ready') {
    await cache.set(`dataset:${id}`, dataset, 600);
  }

  res.json(dataset);
};

// Get dataset preview (first N rows)
const getDatasetPreview = async (req, res) => {
  const { id } = req.params;
  const { rows = 100 } = req.query;

  const dataset = await query('SELECT * FROM datasets WHERE id = $1', [id]);
  if (!dataset.rows.length) return res.status(404).json({ error: 'Dataset not found' });

  if (dataset.rows[0].status !== 'ready') {
    return res.status(400).json({ error: 'Dataset not ready yet', status: dataset.rows[0].status });
  }

  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/api/preview/${id}`, {
      params: { rows, file_path: dataset.rows[0].cleaned_file_path || dataset.rows[0].file_path },
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load preview' });
  }
};

// Get visualization suggestions
const getVisualizationSuggestions = async (req, res) => {
  const { id } = req.params;

  const cacheKey = `suggestions:${id}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const dataset = await query('SELECT * FROM datasets WHERE id = $1', [id]);
  if (!dataset.rows.length) return res.status(404).json({ error: 'Dataset not found' });
  if (dataset.rows[0].status !== 'ready') return res.status(400).json({ error: 'Dataset not ready' });

  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/api/suggestions/${id}`, {
      params: { file_path: dataset.rows[0].cleaned_file_path || dataset.rows[0].file_path },
    });
    await cache.set(cacheKey, response.data, 3600);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
};

// Delete dataset
const deleteDataset = async (req, res) => {
  const { id } = req.params;

  const result = await query(
    'SELECT * FROM datasets WHERE id = $1 AND user_id = $2',
    [id, req.user.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Dataset not found' });
  }

  const dataset = result.rows[0];

  // Delete files
  try {
    if (dataset.file_path && fs.existsSync(dataset.file_path)) fs.unlinkSync(dataset.file_path);
    if (dataset.cleaned_file_path && fs.existsSync(dataset.cleaned_file_path)) fs.unlinkSync(dataset.cleaned_file_path);
  } catch (err) {
    logger.warn('Failed to delete files:', err.message);
  }

  await query('DELETE FROM datasets WHERE id = $1', [id]);
  await cache.del(`dataset:${id}`);
  await cache.del(`suggestions:${id}`);

  res.json({ message: 'Dataset deleted' });
};

// Get chart data
const getChartData = async (req, res) => {
  const { id } = req.params;
  const { xColumn, yColumn, aggregation = 'sum', chartType, filters } = req.query;

  const dataset = await query('SELECT * FROM datasets WHERE id = $1', [id]);
  if (!dataset.rows.length) return res.status(404).json({ error: 'Dataset not found' });
  if (dataset.rows[0].status !== 'ready') return res.status(400).json({ error: 'Dataset not ready' });

  const cacheKey = `chartdata:${id}:${xColumn}:${yColumn}:${aggregation}:${JSON.stringify(filters)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/api/chart-data/${id}`, {
      params: {
        file_path: dataset.rows[0].cleaned_file_path || dataset.rows[0].file_path,
        x_column: xColumn,
        y_column: yColumn,
        aggregation,
        chart_type: chartType,
        filters: filters ? JSON.stringify(filters) : undefined,
      },
    });

    await cache.set(cacheKey, response.data, 300);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get chart data' });
  }
};

module.exports = {
  uploadDataset, getDatasets, getDataset, getDatasetPreview,
  getVisualizationSuggestions, deleteDataset, getChartData,
};
