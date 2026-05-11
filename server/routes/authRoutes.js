const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { signup, login, logout, refreshToken, getProfile } = require('../controllers/authController');

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.get('/profile', protect, getProfile);

module.exports = router;
