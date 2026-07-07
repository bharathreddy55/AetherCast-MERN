const Episode = require('../models/Episode');
const Podcast = require('../models/Podcast');
const Progress = require('../models/Progress');
const path = require('path');
const fs = require('fs');

// @desc    Create a new episode for a podcast
// @route   POST /api/podcasts/:podcastId/episodes
// @access  Private (Creator/Admin)
exports.createEpisode = async (req, res) => {
  try {
    const podcast = await Podcast.findById(req.params.podcastId);
    if (!podcast) {
      return res.status(404).json({ success: false, message: 'Podcast not found' });
    }

    // Verify ownership
    if (podcast.creatorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to add episodes to this podcast' });
    }

    const { title, description, transcript, duration, status } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an audio file (MP3/WAV)' });
    }

    const audioUrl = `/uploads/${req.file.filename}`;

    const episode = await Episode.create({
      podcastId: podcast._id,
      title,
      description,
      audioUrl,
      transcript: transcript || '',
      duration: duration ? Number(duration) : 0,
      status: status || 'draft',
    });

    // Update episode count on Podcast
    podcast.episodeCount += 1;
    await podcast.save();

    if (episode.status === 'published') {
      const { dispatchEpisodeNotification } = require('./notificationController');
      dispatchEpisodeNotification(podcast, episode);
    }

    res.status(201).json({ success: true, episode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all episodes for a podcast
// @route   GET /api/podcasts/:podcastId/episodes
// @access  Public
exports.getEpisodesByPodcast = async (req, res) => {
  try {
    const podcast = await Podcast.findById(req.params.podcastId);
    if (!podcast) {
      return res.status(404).json({ success: false, message: 'Podcast not found' });
    }

    const query = { podcastId: podcast._id };

    // Filter status: if not creator or admin, only show published
    if (!req.user || (req.user.role !== 'admin' && req.user._id.toString() !== podcast.creatorId.toString())) {
      query.status = 'published';
    }

    const episodes = await Episode.find(query).sort({ publishDate: -1 });

    res.status(200).json({ success: true, episodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single episode
// @route   GET /api/episodes/:id
// @access  Public
exports.getEpisodeById = async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id).populate('podcastId');
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    res.status(200).json({ success: true, episode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update an episode
// @route   PUT /api/episodes/:id
// @access  Private (Creator/Admin)
exports.updateEpisode = async (req, res) => {
  try {
    let episode = await Episode.findById(req.params.id).populate('podcastId');
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    const podcast = episode.podcastId;

    // Verify ownership
    if (podcast.creatorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this episode' });
    }

    const { title, description, transcript, duration, status } = req.body;

    const wasPublished = episode.status === 'published';

    if (title) episode.title = title;
    if (description) episode.description = description;
    if (transcript) episode.transcript = transcript;
    if (duration) episode.duration = Number(duration);
    if (status) episode.status = status;

    if (req.file) {
      episode.audioUrl = `/uploads/${req.file.filename}`;
    }

    await episode.save();

    if (!wasPublished && episode.status === 'published') {
      const { dispatchEpisodeNotification } = require('./notificationController');
      dispatchEpisodeNotification(podcast, episode);
    }

    res.status(200).json({ success: true, episode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete an episode
// @route   DELETE /api/episodes/:id
// @access  Private (Creator/Admin)
exports.deleteEpisode = async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id).populate('podcastId');
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    const podcast = episode.podcastId;

    // Verify ownership
    if (podcast.creatorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this episode' });
    }

    await episode.deleteOne();

    // Update episode count on Podcast
    podcast.episodeCount = Math.max(0, podcast.episodeCount - 1);
    await podcast.save();

    res.status(200).json({ success: true, message: 'Episode deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Stream episode audio file (supports HTTP Range Requests)
// @route   GET /api/episodes/:id/stream
// @access  Public
exports.streamEpisode = async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    // Resolve file path
    const audioPath = path.join(__dirname, '../../', episode.audioUrl);

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ success: false, message: 'Audio file not found on server' });
    }

    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(audioPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(200, head);
      fs.createReadStream(audioPath).pipe(res);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Increment episode plays count
// @route   POST /api/episodes/:id/play
// @access  Public
exports.incrementPlayCount = async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    episode.playCount += 1;
    await episode.save();

    res.status(200).json({ success: true, plays: episode.playCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save playback progress
// @route   POST /api/episodes/:id/progress
// @access  Private
exports.saveProgress = async (req, res) => {
  try {
    const { position, duration } = req.body;
    if (position === undefined || !duration) {
      return res.status(400).json({ success: false, message: 'Please provide position and duration' });
    }

    // Determine if completed (e.g., >95% finished)
    const completed = position / duration > 0.95;

    const progress = await Progress.findOneAndUpdate(
      { userId: req.user._id, episodeId: req.params.id },
      { position, duration, completed },
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get playback progress for a specific episode
// @route   GET /api/episodes/:id/progress
// @access  Private
exports.getProgress = async (req, res) => {
  try {
    const progress = await Progress.findOne({
      userId: req.user._id,
      episodeId: req.params.id,
    });

    res.status(200).json({
      success: true,
      progress: progress || { position: 0, duration: 0, completed: false },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get active continue listening list
// @route   GET /api/episodes/continue-listening
// @access  Private
exports.getContinueListening = async (req, res) => {
  try {
    const list = await Progress.find({
      userId: req.user._id,
      completed: false,
    })
      .sort({ updatedAt: -1 })
      .populate({
        path: 'episodeId',
        populate: {
          path: 'podcastId',
          select: 'title coverImage creatorId',
        },
      })
      .limit(6);

    res.status(200).json({ success: true, list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle like/unlike on an episode
// @route   POST /api/episodes/:id/like
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    const userId = req.user._id;
    const alreadyLiked = episode.likedBy.includes(userId);

    if (alreadyLiked) {
      episode.likedBy.pull(userId);
      user.likedEpisodes.pull(episode._id);
    } else {
      episode.likedBy.push(userId);
      user.likedEpisodes.addToSet(episode._id);
    }

    await episode.save();
    await user.save();

    res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likesCount: episode.likedBy.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add episode to user listen history
// @route   POST /api/episodes/:id/history
// @access  Private
exports.addToListenHistory = async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.user._id);

    // Remove existing entry for this episode (to move it to top)
    user.listenHistory = user.listenHistory.filter(
      (h) => h.episodeId.toString() !== episode._id.toString()
    );

    // Add to front
    user.listenHistory.unshift({
      episodeId: episode._id,
      podcastId: episode.podcastId,
      listenedAt: new Date(),
    });

    // Cap history at 50 entries
    if (user.listenHistory.length > 50) {
      user.listenHistory = user.listenHistory.slice(0, 50);
    }

    await user.save();

    res.status(200).json({ success: true, message: 'Added to listen history' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user listen history
// @route   GET /api/episodes/history
// @access  Private
exports.getListenHistory = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id).populate({
      path: 'listenHistory.episodeId',
      populate: {
        path: 'podcastId',
        select: 'title coverImage',
      },
    });

    const history = (user.listenHistory || []).filter((h) => h.episodeId);

    res.status(200).json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user's liked episodes
// @route   GET /api/episodes/liked
// @access  Private
exports.getLikedEpisodes = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id).populate({
      path: 'likedEpisodes',
      populate: {
        path: 'podcastId',
        select: 'title coverImage',
      },
    });

    res.status(200).json({ success: true, episodes: user.likedEpisodes || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate AI Summary & Smart Tags from Episode Transcript
// @route   POST /api/episodes/:id/ai-features
// @access  Private (Creator/Admin)
exports.generateAISummaryAndTags = async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id).populate('podcastId');
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    // Verify creator authorization
    const podcast = episode.podcastId;
    if (podcast.creatorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this episode' });
    }

    const textToProcess = episode.transcript || episode.description;
    if (!textToProcess) {
      return res.status(400).json({ success: false, message: 'No transcript or description available to generate features from' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let aiSummary = '';
    let aiTags = [];

    if (apiKey) {
      // Call actual Gemini 1.5 Flash API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are an AI assistant helping a podcast creator. Please analyze the following podcast text (transcript/description). Output a highly engaging, concise summary of 2-3 sentences and 3-5 relevant, lowercase search tags/topics. Your response must be strictly in valid JSON format matching this schema: {"summary": "concise summary text", "tags": ["tag1", "tag2", ...]}. Do not include any markdown styling like backticks or "json" prefix. Here is the text:\n\n${textToProcess}`
              }]
            }],
            generationConfig: {
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          try {
            const parsed = JSON.parse(jsonText);
            aiSummary = parsed.summary || '';
            aiTags = parsed.tags || [];
          } catch (jsonErr) {
            console.error('Failed to parse Gemini JSON response:', jsonText);
          }
        }
      } else {
        console.error('Gemini API request failed with status:', response.status);
      }
    }

    // Fallback if Gemini key is missing or request failed
    if (!aiSummary || aiTags.length === 0) {
      // Generate fallback summary: First 2 sentences
      const sentences = textToProcess.match(/[^.!?]+[.!?]+/g) || [textToProcess];
      aiSummary = sentences.slice(0, 2).join(' ').trim();
      if (aiSummary.length > 250) {
        aiSummary = aiSummary.substring(0, 247) + '...';
      }

      // Generate fallback tags: Top keywords from text
      const stopwords = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'i', 'is', 'that', 'it', 'on', 'you', 'this', 'for', 'with', 'was', 'as', 'at', 'by', 'an', 'be', 'are']);
      const words = textToProcess
        .toLowerCase()
        .replace(/[^a-zA-Z\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 4 && !stopwords.has(w));
      
      // Calculate frequency map
      const freq = {};
      words.forEach(w => freq[w] = (freq[w] || 0) + 1);
      
      aiTags = Object.keys(freq)
        .sort((a, b) => freq[b] - freq[a])
        .slice(0, 4);
    }

    // Save to Episode in database
    episode.aiSummary = aiSummary;
    episode.aiTags = aiTags;
    await episode.save();

    res.status(200).json({
      success: true,
      message: 'AI Features generated successfully!',
      aiSummary,
      aiTags
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all episodes (with optional search query)
// @route   GET /api/episodes
// @access  Public
exports.getAllEpisodes = async (req, res) => {
  try {
    const { search } = req.query;
    const query = { status: 'published' };

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const episodes = await Episode.find(query)
      .populate('podcastId', 'title')
      .sort({ createdAt: -1 })
      .limit(30);

    res.status(200).json({ success: true, count: episodes.length, episodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


