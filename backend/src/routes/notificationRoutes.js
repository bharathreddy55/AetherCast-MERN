const express = require('express');
const router = express.Router();
const {
  getUserNotifications,
  markNotificationRead,
  markAllRead,
} = require('../controllers/notificationController');
const { protect } = require('../middlewares/auth');

router.use(protect); // Secure all notification routes

router.get('/', getUserNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markNotificationRead);

module.exports = router;
