const express = require('express');
const router = express.Router();
const {
  createPodcast,
  getPodcasts,
  getPodcastById,
  updatePodcast,
  deletePodcast,
  followPodcast,
  unfollowPodcast,
  checkFollowStatus,
  getFollowedPodcasts,
} = require('../controllers/podcastController');
const {
  createEpisode,
  getEpisodesByPodcast,
} = require('../controllers/episodeController');
const {
  addOrUpdateReview,
  getPodcastReviews,
  flagReview,
} = require('../controllers/reviewController');
const { protect, authorize, optionalProtect } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.route('/')
  .post(
    protect,
    authorize('creator', 'admin'),
    upload.fields([
      { name: 'coverImage', maxCount: 1 },
      { name: 'bannerImage', maxCount: 1 },
    ]),
    createPodcast
  )
  .get(getPodcasts);

router.get('/followed', protect, getFollowedPodcasts);

router.route('/:id')
  .get(optionalProtect, getPodcastById)
  .put(
    protect,
    authorize('creator', 'admin'),
    upload.fields([
      { name: 'coverImage', maxCount: 1 },
      { name: 'bannerImage', maxCount: 1 },
    ]),
    updatePodcast
  )
  .delete(protect, authorize('creator', 'admin'), deletePodcast);

// PRD Episode sub-routes
router.post('/:podcastId/episodes', protect, authorize('creator', 'admin'), upload.single('audio'), createEpisode);
router.get('/:podcastId/episodes', optionalProtect, getEpisodesByPodcast);

// Follow/Unfollow routes
router.post('/:id/follow', protect, followPodcast);
router.post('/:id/unfollow', protect, unfollowPodcast);
router.get('/:id/follow-status', protect, checkFollowStatus);

router.route('/:id/reviews')
  .get(getPodcastReviews)
  .post(protect, addOrUpdateReview);

router.post('/:podcastId/reviews/:id/flag', protect, flagReview);

module.exports = router;
