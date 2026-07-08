const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Helper to generate access and refresh tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'your_jwt_access_secret_key_change_me_in_production',
    { expiresIn: '1d' }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_key_change_me_in_production',
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Set refresh token in HTTP-only cookie
const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { username, name, email, password, role, bio } = req.body;

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }

    // Role safety check: only allow 'listener' or 'creator' from register. Admin must be seeded or created by another admin.
    const userRole = role === 'admin' ? 'listener' : role || 'listener';

    // Generate random 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await User.create({
      username,
      name,
      email,
      password,
      role: userRole,
      bio: bio || '',
      isVerified: false, // Require email verification
      otp,
      otpExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    // Send verification email with OTP
    const sendEmail = require('../utils/sendEmail');
    await sendEmail({
      email: user.email,
      subject: 'AetherCast - Your Verification OTP Code',
      message: `Welcome to AetherCast, ${user.name}!\n\nTo complete your signup and log in, please enter the following One-Time Password (OTP) verification code inside the web app:\n\n🔑  ${otp}\n\nThis code is valid for 10 minutes.`,
    });

    res.status(201).json({
      success: true,
      requireOtp: true,
      email: user.email,
      message: 'Registration successful! Verification OTP sent. Please check the server console for the code.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check status
    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended' });
    }

    // Check verification status
    if (!user.isVerified) {
      // Generate a new OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otp = otp;
      user.otpExpires = Date.now() + 10 * 60 * 1000;
      await user.save();

      const sendEmail = require('../utils/sendEmail');
      await sendEmail({
        email: user.email,
        subject: 'AetherCast - Your Verification OTP Code',
        message: `Welcome back to AetherCast, ${user.name}!\n\nTo complete your signup and log in, please enter the following One-Time Password (OTP) verification code inside the web app:\n\n🔑  ${otp}\n\nThis code is valid for 10 minutes.`,
      });

      return res.status(400).json({
        success: false,
        requireOtp: true,
        email: user.email,
        message: 'Please verify your email first. A verification OTP code has been sent to your server console logs.',
      });
    }

    // Match password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: accessToken,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Protected
exports.logout = async (req, res) => {
  try {
    res.clearCookie('refreshToken');
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Protected
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (uses cookie)
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_key_change_me_in_production');
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.accountStatus === 'suspended') {
      return res.status(401).json({ success: false, message: 'User not found or suspended' });
    }

    const tokens = generateTokens(user._id);
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.status(200).json({
      success: true,
      token: tokens.accessToken,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Google OAuth login/signup
// @route   POST /api/auth/google
// @access  Public
exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    let email, name, avatar, googleId;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID token is required' });
    }

    try {
      const { OAuth2Client } = require('google-auth-library');
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      
      email = payload.email;
      name = payload.name;
      avatar = payload.picture;
      googleId = payload.sub;
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Google ID token verification failed: ' + err.message });
    }

    // Find user by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      // If user exists by email but doesn't have googleId linked, update it
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Generate unique username
      const username = email.split('@')[0] + Math.floor(100 + Math.random() * 900);
      
      // Generate random password
      const password = Math.random().toString(36).slice(-10);

      // Generate random 6-digit OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      user = await User.create({
        username,
        name,
        email,
        password,
        role: 'listener', // Default role for Google login
        avatar,
        isVerified: false, // Require email verification
        googleId,
        otp,
        otpExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      // Send verification link with OTP
      const sendEmail = require('../utils/sendEmail');
      await sendEmail({
        email: user.email,
        subject: 'AetherCast - Your Verification OTP Code',
        message: `Welcome to AetherCast, ${user.name}!\n\nYou registered via Google OAuth. To complete your signup and log in, please enter the following One-Time Password (OTP) verification code inside the web app:\n\n🔑  ${otp}\n\nThis code is valid for 10 minutes.`,
      });

      return res.status(201).json({
        success: true,
        requireOtp: true,
        email: user.email,
        message: 'Google signup initiated! Verification OTP sent. Please check the server console for the code.',
      });
    }

    // Check verification status
    if (!user.isVerified) {
      // If they are not verified, let's generate a new OTP and send it so they can verify!
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otp = otp;
      user.otpExpires = Date.now() + 10 * 60 * 1000;
      await user.save();

      const sendEmail = require('../utils/sendEmail');
      await sendEmail({
        email: user.email,
        subject: 'AetherCast - Your Verification OTP Code',
        message: `Welcome back to AetherCast, ${user.name}!\n\nTo complete your signup and log in, please enter the following One-Time Password (OTP) verification code inside the web app:\n\n🔑  ${otp}\n\nThis code is valid for 10 minutes.`,
      });

      return res.status(400).json({
        success: false,
        requireOtp: true,
        email: user.email,
        message: 'Please verify your email first. A new verification OTP code has been sent to your server console logs.',
      });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account is suspended' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      token: accessToken,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP code
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and OTP code' });
    }

    const user = await User.findOne({
      email,
      otp,
      otpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Email verified and logged in successfully!',
      token: accessToken,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Resend OTP code
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide email address' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    // Generate random 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Send verification link with OTP
    const sendEmail = require('../utils/sendEmail');
    await sendEmail({
      email: user.email,
      subject: 'AetherCast - Resent Verification OTP Code',
      message: `Welcome back to AetherCast, ${user.name}!\n\nYou requested a new verification code. Please enter the following One-Time Password (OTP) inside the web app:\n\n🔑  ${otp}\n\nThis code is valid for 10 minutes.`,
    });

    res.status(200).json({
      success: true,
      message: 'A new verification OTP code has been sent to your server console logs.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile details
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { name, bio, role } = req.body;

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (role && req.user.role === 'admin') user.role = role;

    if (req.file) {
      const { uploadToSupabase, saveFileLocally } = require('../utils/supabaseStorage');
      const supabaseUrl = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'avatars');
      user.avatar = supabaseUrl || saveFileLocally(req.file, 'uploads');
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
