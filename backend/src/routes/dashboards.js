const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createDashboard, getDashboards, getDashboard, getPublicDashboard,
  updateDashboard, shareDashboard, deleteDashboard,
  addWidget, updateWidget, deleteWidget, updateWidgetPositions,
} = require('../controllers/dashboardController');

// Public route (no auth)
router.get('/share/:shareToken', getPublicDashboard);

router.use(authenticate);

router.post('/', createDashboard);
router.get('/workspace/:workspaceId', getDashboards);
router.get('/:id', getDashboard);
router.put('/:id', updateDashboard);
router.patch('/:id/share', shareDashboard);
router.delete('/:id', deleteDashboard);

// Widget routes
router.post('/:id/widgets', addWidget);
router.put('/:dashboardId/widgets/:widgetId', updateWidget);
router.delete('/:dashboardId/widgets/:widgetId', deleteWidget);
router.patch('/:id/widgets/positions', updateWidgetPositions);

module.exports = router;
