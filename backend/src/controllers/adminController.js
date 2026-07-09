const User = require('../models/User');
const Podcast = require('../models/Podcast');
const Episode = require('../models/Episode');
const Comment = require('../models/Comment');
const Review = require('../models/Review');

// @desc    Get all users with search and filter
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getUsers = async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (status) {
      query.accountStatus = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total,
      users,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle user account status (active / suspended)
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent admin self-suspension
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot suspend your own admin account' });
    }

    user.accountStatus = user.accountStatus === 'active' ? 'suspended' : 'active';
    await user.save();

    res.status(200).json({
      success: true,
      message: `User account has been ${user.accountStatus} successfully`,
      status: user.accountStatus,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change user role
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin)
exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['listener', 'creator', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully`,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all flagged content (comments and reviews)
// @route   GET /api/admin/flagged
// @access  Private (Admin)
exports.getFlaggedContent = async (req, res) => {
  try {
    const comments = await Comment.find({ isFlagged: true })
      .populate('userId', 'name username email avatar')
      .populate('episodeId', 'title');

    const reviews = await Review.find({ isFlagged: true })
      .populate('userId', 'name username email avatar')
      .populate('podcastId', 'title');

    res.status(200).json({
      success: true,
      comments: comments || [],
      reviews: reviews || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/admin/comments/:id
// @access  Private (Admin)
exports.deleteCommentAdmin = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    await comment.deleteOne();
    res.status(200).json({ success: true, message: 'Comment deleted successfully by admin' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Dismiss flags on a comment
// @route   PUT /api/admin/comments/:id/dismiss
// @access  Private (Admin)
exports.dismissCommentFlags = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    comment.isFlagged = false;
    await comment.save();

    res.status(200).json({ success: true, message: 'Comment flags dismissed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a review and update podcast average ratings
// @route   DELETE /api/admin/reviews/:id
// @access  Private (Admin)
exports.deleteReviewAdmin = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const podcastId = review.podcastId;
    await review.deleteOne();

    // Recalculate ratings
    const reviews = await Review.find({ podcastId });
    const count = reviews.length;
    const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    const average = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;

    await Podcast.findByIdAndUpdate(podcastId, {
      ratingAverage: average,
      ratingCount: count,
    });

    res.status(200).json({ success: true, message: 'Review deleted successfully by admin' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Dismiss flags on a review
// @route   PUT /api/admin/reviews/:id/dismiss
// @access  Private (Admin)
exports.dismissReviewFlags = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    review.isFlagged = false;
    await review.save();

    res.status(200).json({ success: true, message: 'Review flags dismissed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dashboard analytics/statistics for Admin
// @route   GET /api/admin/stats
// @access  Private (Admin)
exports.getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const listeners = await User.countDocuments({ role: 'listener' });
    const creators = await User.countDocuments({ role: 'creator' });
    const admins = await User.countDocuments({ role: 'admin' });

    const totalPodcasts = await Podcast.countDocuments();
    const totalEpisodes = await Episode.countDocuments();

    // Sum of all episode playCounts
    const playStats = await Episode.aggregate([
      { $group: { _id: null, totalPlays: { $sum: '$playCount' } } },
    ]);
    const totalPlays = playStats[0]?.totalPlays || 0;

    const flaggedComments = await Comment.countDocuments({ isFlagged: true });
    const flaggedReviews = await Review.countDocuments({ isFlagged: true });

    res.status(200).json({
      success: true,
      stats: {
        users: { total: totalUsers, listeners, creators, admins },
        podcasts: totalPodcasts,
        episodes: totalEpisodes,
        plays: totalPlays,
        flagged: { comments: flaggedComments, reviews: flaggedReviews, total: flaggedComments + flaggedReviews },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all podcasts for Admin management
// @route   GET /api/admin/podcasts
// @access  Private (Admin)
exports.getPodcastsAdmin = async (req, res) => {
  try {
    const podcasts = await Podcast.find().populate('creatorId', 'name username email').sort({ createdAt: -1 });
    res.status(200).json({ success: true, podcasts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete any podcast by Admin
// @route   DELETE /api/admin/podcasts/:id
// @access  Private (Admin)
exports.deletePodcastAdmin = async (req, res) => {
  try {
    const podcast = await Podcast.findById(req.params.id);
    if (!podcast) {
      return res.status(404).json({ success: false, message: 'Podcast not found' });
    }

    const fs = require('fs');
    const path = require('path');

    // Delete all related episodes and their physical files
    const episodes = await Episode.find({ podcastId: podcast._id });
    for (const ep of episodes) {
      if (ep.audioUrl && ep.audioUrl.startsWith('/uploads/')) {
        const localPath = path.join(__dirname, '../../', ep.audioUrl);
        if (fs.existsSync(localPath)) {
          try { fs.unlinkSync(localPath); } catch (e) { console.error('Failed to delete audio:', e.message); }
        }
      }
    }

    // Delete podcast cover & banner images
    if (podcast.coverImage && podcast.coverImage.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '../../', podcast.coverImage);
      if (fs.existsSync(localPath)) {
        try { fs.unlinkSync(localPath); } catch (e) { console.error('Failed to delete cover:', e.message); }
      }
    }
    if (podcast.bannerImage && podcast.bannerImage.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '../../', podcast.bannerImage);
      if (fs.existsSync(localPath)) {
        try { fs.unlinkSync(localPath); } catch (e) { console.error('Failed to delete banner:', e.message); }
      }
    }

    await Episode.deleteMany({ podcastId: podcast._id });
    await Review.deleteMany({ podcastId: podcast._id });
    await podcast.deleteOne();

    res.status(200).json({ success: true, message: 'Podcast show and all its episodes deleted successfully by Admin' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all episodes for Admin management
// @route   GET /api/admin/episodes
// @access  Private (Admin)
exports.getEpisodesAdmin = async (req, res) => {
  try {
    const episodes = await Episode.find().populate('podcastId', 'title').sort({ createdAt: -1 });
    res.status(200).json({ success: true, episodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete any episode by Admin
// @route   DELETE /api/admin/episodes/:id
// @access  Private (Admin)
exports.deleteEpisodeAdmin = async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    const fs = require('fs');
    const path = require('path');

    if (episode.audioUrl && episode.audioUrl.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '../../', episode.audioUrl);
      if (fs.existsSync(localPath)) {
        try { fs.unlinkSync(localPath); } catch (e) { console.error('Failed to delete audio:', e.message); }
      }
    }

    const podcastId = episode.podcastId;
    await episode.deleteOne();

    // Update podcast episode count
    const episodeCount = await Episode.countDocuments({ podcastId });
    await Podcast.findByIdAndUpdate(podcastId, { episodeCount });

    res.status(200).json({ success: true, message: 'Episode deleted successfully by Admin' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete any user profile from MongoDB
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
exports.deleteUserAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete another admin account' });
    }

    // Find all reviews made by this user to know which podcasts are affected
    const userReviews = await Review.find({ userId: user._id });
    const affectedPodcastIds = [...new Set(userReviews.map((r) => r.podcastId.toString()))];

    // Clean up reviews and comments
    await Review.deleteMany({ userId: user._id });
    await Comment.deleteMany({ userId: user._id });

    // Recalculate rating stats for affected podcasts
    for (const podcastId of affectedPodcastIds) {
      const reviews = await Review.find({ podcastId });
      const count = reviews.length;
      const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
      const average = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;

      await Podcast.findByIdAndUpdate(podcastId, {
        ratingAverage: average,
        ratingCount: count,
      });
    }
    
    await user.deleteOne();

    res.status(200).json({ success: true, message: 'User profile deleted successfully by Admin' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get detailed user metrics (playlists, podcasts, comments, reviews)
// @route   GET /api/admin/users/:id
// @access  Private (Admin)
exports.getUserDetailsAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let podcasts = [];
    let playlistsCount = 0;
    let comments = [];
    let reviews = [];

    // Fetch playlists count for everyone
    playlistsCount = await Playlist.countDocuments({ userId: user._id });

    // Fetch comments and reviews made by this user
    comments = await Comment.find({ userId: user._id })
      .populate('episodeId', 'title')
      .sort({ createdAt: -1 })
      .limit(10);

    reviews = await Review.find({ userId: user._id })
      .populate('podcastId', 'title')
      .sort({ createdAt: -1 })
      .limit(10);

    // If creator, fetch their podcasts
    if (user.role === 'creator' || user.role === 'admin') {
      podcasts = await Podcast.find({ creatorId: user._id })
        .select('title coverImage status category episodeCount followersCount')
        .sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      user,
      details: {
        playlistsCount,
        comments,
        reviews,
        podcasts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all comments for Admin management (not just flagged ones)
// @route   GET /api/admin/comments
// @access  Private (Admin)
exports.getCommentsAdmin = async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};

    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    const comments = await Comment.find(query)
      .populate('userId', 'name username email')
      .populate({
        path: 'episodeId',
        select: 'title',
        populate: {
          path: 'podcastId',
          select: 'title'
        }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
