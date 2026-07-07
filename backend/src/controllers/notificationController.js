const Notification = require('../models/Notification');
const Follower = require('../models/Follower');

// @desc    Get all notifications for logged in user
// @route   GET /api/notifications
// @access  Private
exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30); // Return last 30 notifications

    res.status(200).json({ success: true, count: notifications.length, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Dispatch notification to all podcast followers (Helper utility)
// @access  Internal
exports.dispatchEpisodeNotification = async (podcast, episode) => {
  try {
    // Find all followers
    const followers = await Follower.find({ podcastId: podcast._id });
    if (followers.length === 0) return;

    // Create notifications array
    const notifications = followers.map((f) => ({
      userId: f.userId,
      title: 'New Episode Published!',
      content: `"${episode.title}" is now available in ${podcast.title}.`,
      podcastId: podcast._id,
      episodeId: episode._id,
    }));

    // Batch insert
    await Notification.insertMany(notifications);
  } catch (error) {
    console.error('Notification dispatch failure:', error.message);
  }
};
