const Bookmark = require('../models/Bookmark');
const Episode = require('../models/Episode');

// @desc    Create a timestamp note/bookmark
// @route   POST /api/bookmarks
// @access  Private
exports.createBookmark = async (req, res) => {
  try {
    const { episodeId, timestamp, note } = req.body;
    if (!episodeId || timestamp === undefined || !note) {
      return res.status(400).json({ success: false, message: 'Please provide episodeId, timestamp and note' });
    }

    const episode = await Episode.findById(episodeId);
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    const bookmark = await Bookmark.create({
      userId: req.user._id,
      episodeId,
      timestamp,
      note
    });

    res.status(210).json({ success: true, data: bookmark });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all bookmarks for a specific episode of the logged-in user
// @route   GET /api/bookmarks/episode/:episodeId
// @access  Private
exports.getEpisodeBookmarks = async (req, res) => {
  try {
    const { episodeId } = req.params;
    const bookmarks = await Bookmark.find({
      userId: req.user._id,
      episodeId
    }).sort({ timestamp: 1 }); // Sort by time

    res.status(200).json({ success: true, data: bookmarks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a specific bookmark
// @route   DELETE /api/bookmarks/:id
// @access  Private
exports.deleteBookmark = async (req, res) => {
  try {
    const bookmark = await Bookmark.findById(req.params.id);
    if (!bookmark) {
      return res.status(404).json({ success: false, message: 'Bookmark not found' });
    }

    // Verify ownership
    if (bookmark.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this bookmark' });
    }

    await bookmark.deleteOne();
    res.status(200).json({ success: true, message: 'Bookmark deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
