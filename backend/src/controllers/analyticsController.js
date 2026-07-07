const Podcast = require('../models/Podcast');
const Episode = require('../models/Episode');
const Review = require('../models/Review');
const Follower = require('../models/Follower');

// @desc    Get secure creator analytics stats
// @route   GET /api/analytics/creator
// @access  Private (Creator/Admin)
exports.getCreatorStats = async (req, res) => {
  try {
    const creatorId = req.user._id;

    // Find all podcasts created by this user
    const podcasts = await Podcast.find({ creatorId });
    const podcastIds = podcasts.map((p) => p._id);

    if (podcastIds.length === 0) {
      return res.status(200).json({
        success: true,
        stats: {
          totalPlays: 0,
          totalFollowers: 0,
          totalReviews: 0,
          avgRating: 0,
          showsCount: 0,
          episodesCount: 0,
          categoryDistribution: [],
          topEpisodes: [],
        },
      });
    }

    // 1. Calculate Total Followers
    const totalFollowers = podcasts.reduce((sum, p) => sum + (p.followersCount || 0), 0);

    // 2. Fetch all episodes under these shows
    const episodes = await Episode.find({ podcastId: { $in: podcastIds } });
    const totalPlays = episodes.reduce((sum, e) => sum + (e.playCount || 0), 0);

    // 3. Category distribution
    const categoryMap = {};
    podcasts.forEach((p) => {
      if (p.category) {
        categoryMap[p.category] = (categoryMap[p.category] || 0) + 1;
      }
    });
    const categoryDistribution = Object.keys(categoryMap).map((cat) => ({
      category: cat,
      count: categoryMap[cat],
    }));

    // 4. Average rating across these shows
    const ratedPodcasts = podcasts.filter((p) => p.ratingCount > 0);
    const avgRating =
      ratedPodcasts.length > 0
        ? ratedPodcasts.reduce((sum, p) => sum + p.ratingAverage, 0) / ratedPodcasts.length
        : 0;

    // 5. Total reviews
    const totalReviews = podcasts.reduce((sum, p) => sum + (p.ratingCount || 0), 0);

    // 6. Top episodes by plays
    const topEpisodes = [...episodes]
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 5)
      .map((e) => {
        const parentPodcast = podcasts.find((p) => p._id.toString() === e.podcastId.toString());
        return {
          _id: e._id,
          title: e.title,
          playCount: e.playCount || 0,
          podcastTitle: parentPodcast ? parentPodcast.title : 'Show',
          publishDate: e.publishDate,
        };
      });

    res.status(200).json({
      success: true,
      stats: {
        totalPlays,
        totalFollowers,
        totalReviews,
        avgRating: Number(avgRating.toFixed(2)),
        showsCount: podcasts.length,
        episodesCount: episodes.length,
        categoryDistribution,
        topEpisodes,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
