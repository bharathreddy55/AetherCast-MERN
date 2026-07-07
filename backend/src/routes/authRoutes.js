const express = require('express');
const router = express.Router();
const { register, login, logout, getProfile, refreshToken, googleLogin, verifyOtp, resendOtp, updateProfile } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, upload.single('avatar'), updateProfile);

module.exports = router;
