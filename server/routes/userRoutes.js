const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { searchUsers, getUserStatus } = require('../controllers/userController');

router.get('/', protect, searchUsers);
router.get('/:id/status', protect, getUserStatus);

module.exports = router;
