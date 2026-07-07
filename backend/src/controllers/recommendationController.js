const Podcast = require('../models/Podcast');
const Follower = require('../models/Follower');

// @desc    Get smart recommendations for listener
// @route   GET /api/recommendations
// @access  Private
exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all followed podcasts
    const followedRelations = await Follower.find({ userId });
    const followedIds = followedRelations.map((f) => f.podcastId);

    let query = {
      status: 'published',
      _id: { $nin: followedIds }, // Exclude podcasts the user already follows
    };

    // Find categories of podcasts the user follows
    if (followedIds.length > 0) {
      const followedPodcasts = await Podcast.find({ _id: { $in: followedIds } });
      const categories = followedPodcasts.map((p) => p.category).filter(Boolean);

      if (categories.length > 0) {
        // Build a query prioritizing these categories
        query.category = { $in: categories };
      }
    }

    // Fetch recommendations (limit to 5)
    let recommendations = await Podcast.find(query)
      .populate('creatorId', 'name username avatar')
      .sort({ ratingAverage: -1, followersCount: -1 })
      .limit(5);

    // If no category-specific recommendations found, fall back to top podcasts platform-wide
    if (recommendations.length === 0) {
      delete query.category; // Remove category constraint
      recommendations = await Podcast.find(query)
        .populate('creatorId', 'name username avatar')
        .sort({ ratingAverage: -1, followersCount: -1 })
        .limit(5);
    }

    res.status(200).json({ success: true, count: recommendations.length, recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
