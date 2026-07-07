const express = require('express');
const router = express.Router();
const { getCreatorStats } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middlewares/auth');

// Allow creators and admins to access statistics
router.get('/creator', protect, authorize('creator', 'admin'), getCreatorStats);

module.exports = router;
