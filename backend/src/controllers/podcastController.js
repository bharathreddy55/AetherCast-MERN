const Podcast = require('../models/Podcast');
const Follower = require('../models/Follower');
const User = require('../models/User');
const Episode = require('../models/Episode');

// @desc    Create a new podcast
// @route   POST /api/podcasts
// @access  Private (Creator/Admin)
exports.createPodcast = async (req, res) => {
  try {
    const { title, description, category, tags, language, status } = req.body;

    let coverImage = '';
    let bannerImage = '';

    if (req.files) {
      if (req.files.coverImage) {
        coverImage = `/uploads/${req.files.coverImage[0].filename}`;
      }
      if (req.files.bannerImage) {
        bannerImage = `/uploads/${req.files.bannerImage[0].filename}`;
      }
    }

    const tagsArray = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

    const podcast = await Podcast.create({
      title,
      description,
      category,
      tags: tagsArray,
      language: language || 'English',
      coverImage,
      bannerImage,
      creatorId: req.user._id,
      status: status || 'draft',
    });

    res.status(201).json({ success: true, podcast });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all podcasts (with filters, search, and pagination)
// @route   GET /api/podcasts
// @access  Public
exports.getPodcasts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, tag, creatorId } = req.query;

    const query = { status: 'published' }; // Only show published by default

    // If a creator is checking their own podcasts, they can see drafts too
    if (creatorId) {
      query.creatorId = creatorId;
      delete query.status; // Creator sees all their own
    }

    if (category) {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    if (tag) {
      query.tags = { $in: [tag] };
    }

    let matchedEpisodes = [];
    if (search) {
      matchedEpisodes = await Episode.find({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { transcript: { $regex: search, $options: 'i' } },
        ]
      });

      const matchedPodcastIds = matchedEpisodes.map((ep) => ep.podcastId.toString());

      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { _id: { $in: matchedPodcastIds } }
      ];
    }

    const skipIndex = (page - 1) * limit;

    const total = await Podcast.countDocuments(query);
    const podcasts = await Podcast.find(query)
      .populate('creatorId', 'name username avatar')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skipIndex);

    // Map to attach matched episode info
    const podcastsPlain = podcasts.map((p) => {
      const pObj = p.toObject();
      if (search) {
        const eps = matchedEpisodes.filter((e) => e.podcastId.toString() === pObj._id.toString());
        if (eps.length > 0) {
          pObj.matchedEpisodes = eps.map((e) => {
            let snippet = '';
            if (e.transcript && e.transcript.toLowerCase().includes(search.toLowerCase())) {
              const idx = e.transcript.toLowerCase().indexOf(search.toLowerCase());
              const start = Math.max(0, idx - 40);
              const end = Math.min(e.transcript.length, idx + search.length + 40);
              snippet = `...${e.transcript.slice(start, end).replace(/\n/g, ' ')}...`;
            }
            return {
              _id: e._id,
              title: e.title,
              snippet
            };
          });
        }
      }
      return pObj;
    });

    res.status(200).json({
      success: true,
      count: podcastsPlain.length,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      totalPodcasts: total,
      podcasts: podcastsPlain,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single podcast by ID
// @route   GET /api/podcasts/:id
// @access  Public
exports.getPodcastById = async (req, res) => {
  try {
    const podcast = await Podcast.findById(req.id || req.params.id)
      .populate('creatorId', 'name username avatar bio');

    if (!podcast) {
      return res.status(404).json({ success: false, message: 'Podcast not found' });
    }

    // Check draft permission
    if (podcast.status === 'draft') {
      if (!req.user || (req.user.role !== 'admin' && req.user._id.toString() !== podcast.creatorId._id.toString())) {
        return res.status(403).json({ success: false, message: 'Access denied: this is a draft' });
      }
    }

    res.status(200).json({ success: true, podcast });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a podcast
// @route   PUT /api/podcasts/:id
// @access  Private (Creator/Admin)
exports.updatePodcast = async (req, res) => {
  try {
    let podcast = await Podcast.findById(req.params.id);

    if (!podcast) {
      return res.status(404).json({ success: false, message: 'Podcast not found' });
    }

    // Make sure user is creator or admin
    if (podcast.creatorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this podcast' });
    }

    const { title, description, category, tags, language, status } = req.body;
    
    if (title) podcast.title = title;
    if (description) podcast.description = description;
    if (category) podcast.category = category;
    if (language) podcast.language = language;
    if (status) podcast.status = status;
    if (tags) {
      podcast.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    }

    if (req.files) {
      if (req.files.coverImage) {
        podcast.coverImage = `/uploads/${req.files.coverImage[0].filename}`;
      }
      if (req.files.bannerImage) {
        podcast.bannerImage = `/uploads/${req.files.bannerImage[0].filename}`;
      }
    }

    await podcast.save();
    res.status(200).json({ success: true, podcast });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a podcast
// @route   DELETE /api/podcasts/:id
// @access  Private (Creator/Admin)
exports.deletePodcast = async (req, res) => {
  try {
    const podcast = await Podcast.findById(req.params.id);

    if (!podcast) {
      return res.status(404).json({ success: false, message: 'Podcast not found' });
    }

    // Make sure user is creator or admin
    if (podcast.creatorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this podcast' });
    }

    await podcast.deleteOne();

    res.status(200).json({ success: true, message: 'Podcast deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Follow a podcast
// @route   POST /api/podcasts/:id/follow
// @access  Private (Listener/Creator/Admin)
exports.followPodcast = async (req, res) => {
  try {
    const podcast = await Podcast.findById(req.params.id);
    if (!podcast) {
      return res.status(404).json({ success: false, message: 'Podcast not found' });
    }

    const alreadyFollowing = await Follower.findOne({
      userId: req.user._id,
      podcastId: podcast._id,
    });

    if (alreadyFollowing) {
      return res.status(400).json({ success: false, message: 'You are already following this podcast' });
    }

    await Follower.create({
      userId: req.user._id,
      podcastId: podcast._id,
    });

    // Update followersCount on Podcast
    podcast.followersCount += 1;
    await podcast.save();

    res.status(200).json({ success: true, message: 'Podcast followed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unfollow a podcast
// @route   POST /api/podcasts/:id/unfollow
// @access  Private (Listener/Creator/Admin)
exports.unfollowPodcast = async (req, res) => {
  try {
    const podcast = await Podcast.findById(req.params.id);
    if (!podcast) {
      return res.status(404).json({ success: false, message: 'Podcast not found' });
    }

    const followerRelation = await Follower.findOne({
      userId: req.user._id,
      podcastId: podcast._id,
    });

    if (!followerRelation) {
      return res.status(400).json({ success: false, message: 'You are not following this podcast' });
    }

    await followerRelation.deleteOne();

    // Update followersCount on Podcast
    podcast.followersCount = Math.max(0, podcast.followersCount - 1);
    await podcast.save();

    res.status(200).json({ success: true, message: 'Podcast unfollowed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check follow status for a podcast
// @route   GET /api/podcasts/:id/follow-status
// @access  Private
exports.checkFollowStatus = async (req, res) => {
  try {
    const following = await Follower.exists({
      userId: req.user._id,
      podcastId: req.params.id,
    });
    res.status(200).json({ success: true, following: !!following });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all podcasts followed by the user
// @route   GET /api/podcasts/followed
// @access  Private
exports.getFollowedPodcasts = async (req, res) => {
  try {
    const follows = await Follower.find({ userId: req.user._id }).populate({
      path: 'podcastId',
      populate: { path: 'creatorId', select: 'name username avatar' }
    });
    const podcasts = follows.map((f) => f.podcastId).filter(Boolean);
    res.status(200).json({ success: true, podcasts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
