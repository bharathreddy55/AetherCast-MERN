const express = require('express');
const router = express.Router();
const {
  createEpisode,
  getEpisodesByPodcast,
  getEpisodeById,
  updateEpisode,
  deleteEpisode,
  streamEpisode,
  incrementPlayCount,
  saveProgress,
  getProgress,
  getContinueListening,
  toggleLike,
  addToListenHistory,
  getListenHistory,
  getLikedEpisodes,
  generateAISummaryAndTags,
  getAllEpisodes,
  updateEpisodeTranscript,
  askEpisodeAI
} = require('../controllers/episodeController');
const {
  addComment,
  getEpisodeComments,
} = require('../controllers/commentController');
const { protect, authorize, optionalProtect } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Podcast sub-routes (placed here but can be routed from app.js)
// POST /api/podcasts/:podcastId/episodes
// GET /api/podcasts/:podcastId/episodes
router.post('/podcast/:podcastId', protect, authorize('creator', 'admin'), upload.single('audio'), createEpisode);
router.get('/podcast/:podcastId', optionalProtect, getEpisodesByPodcast);
router.get('/', optionalProtect, getAllEpisodes);

// Continue listening queue (needs to be above /:id)
router.get('/continue-listening', protect, getContinueListening);

// Listen history & Liked episodes (needs to be above /:id)
router.get('/history', protect, getListenHistory);
router.get('/liked', protect, getLikedEpisodes);

// Episode CRUD
router.route('/:id')
  .get(getEpisodeById)
  .put(protect, authorize('creator', 'admin'), upload.single('audio'), updateEpisode)
  .delete(protect, authorize('creator', 'admin'), deleteEpisode);

// Streaming & Stats
router.get('/:id/stream', streamEpisode);
router.post('/:id/play', incrementPlayCount);

// Like / Unlike
router.post('/:id/like', protect, toggleLike);

// Listen History
router.post('/:id/history', protect, addToListenHistory);

// AI Features (Summary & Tags)
router.post('/:id/ai-features', protect, generateAISummaryAndTags);
router.post('/:id/chat', askEpisodeAI);

// Transcript Editing
router.put('/:id/transcript', protect, authorize('creator', 'admin'), updateEpisodeTranscript);

// Playback Progress
router.route('/:id/progress')
  .get(protect, getProgress)
  .post(protect, saveProgress);

// Comments routes
router.route('/:id/comments')
  .get(getEpisodeComments)
  .post(protect, addComment);

module.exports = router;
