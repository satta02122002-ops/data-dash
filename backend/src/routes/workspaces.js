const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getWorkspace, createWorkspace, updateWorkspace,
  inviteMember, removeMember, getWorkspaceStats,
} = require('../controllers/workspaceController');

router.use(authenticate);

router.post('/', createWorkspace);
router.get('/:id', getWorkspace);
router.put('/:id', updateWorkspace);
router.get('/:id/stats', getWorkspaceStats);
router.post('/:id/members', inviteMember);
router.delete('/:id/members/:userId', removeMember);

module.exports = router;
