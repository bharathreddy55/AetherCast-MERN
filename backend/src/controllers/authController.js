const User = require('../models/User');
const EmailLog = require('../models/EmailLog');

// Owner authentication and session refresh are handled by Supabase.

exports.logout = async (req, res) => {
  try {
    res.clearCookie('refreshToken');
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

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

exports.logEmailSent = async (req, res) => {
  try {
    const { type } = req.body;
    if (!['signup', 'reset'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid email dispatch type' });
    }

    await EmailLog.create({ type });
    res.status(200).json({ success: true, message: 'Email dispatch logged successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEmailCooldown = async (req, res) => {
  try {
    // Find logs in the last hour (TTL index handles the cleanup automatically, so we just get all existing logs)
    const logs = await EmailLog.find().sort({ createdAt: 1 });
    res.status(200).json({
      success: true,
      oldestEmailTime: logs[0] ? logs[0].createdAt : null,
      activeLogsCount: logs.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
