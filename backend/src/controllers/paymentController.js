const Episode = require('../models/Episode');
const User = require('../models/User');

// @desc    Simulate payment / checkout for a premium episode
// @route   POST /api/payments/checkout
// @access  Private
exports.simulateCheckout = async (req, res) => {
  try {
    const { episodeId } = req.body;
    if (!episodeId) {
      return res.status(400).json({ success: false, message: 'Please provide an episodeId' });
    }

    const episode = await Episode.findById(episodeId);
    if (!episode) {
      return res.status(404).json({ success: false, message: 'Episode not found' });
    }

    // Check if user already purchased it
    const isAlreadyPurchased = req.user.purchasedEpisodes.includes(episodeId);
    if (isAlreadyPurchased) {
      return res.status(200).json({ success: true, message: 'Episode already purchased', liked: true });
    }

    // Add to purchased list
    req.user.purchasedEpisodes.push(episodeId);
    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Simulated payment successful! Episode purchased.',
      purchasedEpisodes: req.user.purchasedEpisodes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
