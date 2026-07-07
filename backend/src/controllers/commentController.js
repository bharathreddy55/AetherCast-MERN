const Comment = require('../models/Comment');
const Episode = require('../models/Episode');

// @desc    Add a comment to an episode
// @route   POST /api/episodes/:episodeId/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const episode = await Episode.findById(req.params.episodeId);
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    const comment = await Comment.create({
      userId: req.user._id,
      episodeId: episode._id,
      content,
    });

    // Populate user details for returning immediately
    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'name username avatar');

    res.status(201).json({ success: true, comment: populatedComment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get comments for an episode
// @route   GET /api/episodes/:episodeId/comments
// @access  Public
exports.getEpisodeComments = async (req, res) => {
  try {
    const comments = await Comment.find({ episodeId: req.params.episodeId })
      .populate('userId', 'name username avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: comments.length, comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id).populate({
      path: 'episodeId',
      populate: { path: 'podcastId' },
    });

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const episode = comment.episodeId;
    const podcast = episode.podcastId;

    // Authorization check: comment owner, podcast creator, or admin can delete
    const isOwner = comment.userId.toString() === req.user._id.toString();
    const isPodcastCreator = podcast.creatorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isPodcastCreator && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    await comment.deleteOne();

    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Flag a comment
// @route   POST /api/comments/:id/flag
// @access  Private
exports.flagComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    comment.isFlagged = true;
    await comment.save();

    res.status(200).json({ success: true, message: 'Comment has been flagged for moderation' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
