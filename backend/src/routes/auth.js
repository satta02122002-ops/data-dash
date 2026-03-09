const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  register, login, refreshToken, logout, getMe, updateProfile,
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateProfile);

module.exports = router;
