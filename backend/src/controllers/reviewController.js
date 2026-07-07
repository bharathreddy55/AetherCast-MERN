const Review = require('../models/Review');
const Podcast = require('../models/Podcast');

// Helper function to update podcast rating stats
const updatePodcastRatingStats = async (podcastId) => {
  try {
    const reviews = await Review.find({ podcastId });
    const count = reviews.length;
    const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    const average = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;

    await Podcast.findByIdAndUpdate(podcastId, {
      ratingAverage: average,
      ratingCount: count,
    });
  } catch (error) {
    console.error('Failed to update podcast rating stats:', error.message);
  }
};

// @desc    Add or update a rating/review for a podcast
// @route   POST /api/podcasts/:podcastId/reviews
// @access  Private
exports.addOrUpdateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const podcastId = req.params.podcastId;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Please provide a rating between 1 and 5' });
    }

    const podcast = await Podcast.findById(podcastId);
    if (!podcast) {
      return res.status(404).json({ success: false, message: 'Podcast not found' });
    }

    // Check if review already exists
    let review = await Review.findOne({ userId: req.user._id, podcastId });

    if (review) {
      // Update existing review
      review.rating = Number(rating);
      review.comment = comment || '';
      await review.save();
    } else {
      // Create new review
      review = await Review.create({
        userId: req.user._id,
        podcastId,
        rating: Number(rating),
        comment: comment || '',
      });
    }

    // Recalculate stats
    await updatePodcastRatingStats(podcastId);

    // Fetch populated review to return
    const populatedReview = await Review.findById(review._id).populate('userId', 'name username avatar');

    res.status(200).json({ success: true, review: populatedReview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reviews for a podcast
// @route   GET /api/podcasts/:podcastId/reviews
// @access  Public
exports.getPodcastReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ podcastId: req.params.podcastId })
      .populate('userId', 'name username avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Flag a review
// @route   POST /api/podcasts/:podcastId/reviews/:id/flag
// @access  Private
exports.flagReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    review.isFlagged = true;
    await review.save();

    res.status(200).json({ success: true, message: 'Review has been flagged for moderation' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
