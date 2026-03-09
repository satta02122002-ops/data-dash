const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  uploadDataset, getDatasets, getDataset, getDatasetPreview,
  getVisualizationSuggestions, deleteDataset, getChartData,
} = require('../controllers/datasetController');

router.use(authenticate);

router.post('/upload', upload.single('file'), uploadDataset);
router.get('/workspace/:workspaceId', getDatasets);
router.get('/:id', getDataset);
router.get('/:id/preview', getDatasetPreview);
router.get('/:id/suggestions', getVisualizationSuggestions);
router.get('/:id/chart-data', getChartData);
router.delete('/:id', deleteDataset);

module.exports = router;
