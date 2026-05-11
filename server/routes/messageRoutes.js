const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { allMessages } = require('../controllers/messageController');

router.get('/:chatId', protect, allMessages);

module.exports = router;
