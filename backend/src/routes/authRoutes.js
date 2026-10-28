const express = require('express');
const router = express.Router();
const { 
  logout, 
  getProfile, 
  updateProfile,
  logEmailSent,
  getEmailCooldown
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { registrationClosed } = require('../config/privateAccess');

// Supabase handles owner sign-in. Close legacy public account/token flows.
router.post(['/register', '/login', '/google', '/verify-otp', '/resend-otp', '/refresh'], registrationClosed);
router.post('/logout', protect, logout);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, upload.single('avatar'), updateProfile);

// Rate-limiting logging helpers
router.post('/log-email', logEmailSent);
router.get('/email-cooldown', getEmailCooldown);

module.exports = router;
