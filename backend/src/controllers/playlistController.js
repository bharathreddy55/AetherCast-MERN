const Playlist = require('../models/Playlist');
const Episode = require('../models/Episode');

// @desc    Create a new playlist
// @route   POST /api/playlists
// @access  Private
exports.createPlaylist = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Playlist name is required' });
    }

    const playlist = await Playlist.create({
      userId: req.user._id,
      name,
      description: description || '',
      episodes: [],
    });

    res.status(201).json({ success: true, playlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user's playlists
// @route   GET /api/playlists
// @access  Private
exports.getUserPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ userId: req.user._id })
      .populate({
        path: 'episodes',
        limit: 1,
        populate: { path: 'podcastId', select: 'coverImage' }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: playlists.length, playlists });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get playlist by ID
// @route   GET /api/playlists/:id
// @access  Private
exports.getPlaylistById = async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ _id: req.params.id, userId: req.user._id })
      .populate({
        path: 'episodes',
        populate: {
          path: 'podcastId',
          select: 'title coverImage creatorId',
          populate: { path: 'creatorId', select: 'name' }
        }
      });

    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found or access denied' });
    }

    res.status(200).json({ success: true, playlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add an episode to a playlist
// @route   POST /api/playlists/:id/episodes
// @access  Private
exports.addEpisodeToPlaylist = async (req, res) => {
  try {
    const { episodeId } = req.body;
    if (!episodeId) {
      return res.status(400).json({ success: false, message: 'Episode ID is required' });
    }

    const playlist = await Playlist.findOne({ _id: req.params.id, userId: req.user._id });
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Check if episode is already in playlist
    if (playlist.episodes.includes(episodeId)) {
      return res.status(400).json({ success: false, message: 'Episode is already in this playlist' });
    }

    // Verify episode exists
    const episode = await Episode.findById(episodeId);
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    playlist.episodes.push(episodeId);
    await playlist.save();

    res.status(200).json({ success: true, playlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove an episode from a playlist
// @route   DELETE /api/playlists/:id/episodes/:episodeId
// @access  Private
exports.removeEpisodeFromPlaylist = async (req, res) => {
  try {
    const { id, episodeId } = req.params;

    const playlist = await Playlist.findOne({ _id: id, userId: req.user._id });
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    playlist.episodes = playlist.episodes.filter((ep) => ep.toString() !== episodeId);
    await playlist.save();

    res.status(200).json({ success: true, playlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a playlist
// @route   DELETE /api/playlists/:id
// @access  Private
exports.deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found or access denied' });
    }

    res.status(200).json({ success: true, message: 'Playlist deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
