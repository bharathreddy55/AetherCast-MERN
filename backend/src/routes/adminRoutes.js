const express = require('express');
const router = express.Router();
const {
  getUsers,
  toggleUserStatus,
  changeUserRole,
  getFlaggedContent,
  deleteCommentAdmin,
  dismissCommentFlags,
  deleteReviewAdmin,
  dismissReviewFlags,
  getAdminStats,
  getPodcastsAdmin,
  deletePodcastAdmin,
  getEpisodesAdmin,
  deleteEpisodeAdmin,
  deleteUserAdmin,
  getCommentsAdmin,
  getUserDetailsAdmin,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/auth');

// Protect all routes to only be accessible by admins
router.use(protect, authorize('admin'));

// Admin Dashboard stats
router.get('/stats', getAdminStats);

// User administration
router.get('/users', getUsers);
router.get('/users/:id', getUserDetailsAdmin);
router.put('/users/:id/status', toggleUserStatus);
router.put('/users/:id/role', changeUserRole);
router.delete('/users/:id', deleteUserAdmin);

// Podcast & Episode administration
router.get('/podcasts', getPodcastsAdmin);
router.delete('/podcasts/:id', deletePodcastAdmin);
router.get('/episodes', getEpisodesAdmin);
router.delete('/episodes/:id', deleteEpisodeAdmin);

// Flagged Content Moderation
router.get('/flagged', getFlaggedContent);

// Comment actions
router.get('/comments', getCommentsAdmin);
router.delete('/comments/:id', deleteCommentAdmin);
router.put('/comments/:id/dismiss', dismissCommentFlags);

// Review actions
router.delete('/reviews/:id', deleteReviewAdmin);
router.put('/reviews/:id/dismiss', dismissReviewFlags);

module.exports = router;
