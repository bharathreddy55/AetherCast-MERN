const express = require('express');
const router = express.Router();
const {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addEpisodeToPlaylist,
  removeEpisodeFromPlaylist,
  deletePlaylist,
} = require('../controllers/playlistController');
const { protect } = require('../middlewares/auth');

router.use(protect); // Secure all playlist routes

router.route('/')
  .post(createPlaylist)
  .get(getUserPlaylists);

router.route('/:id')
  .get(getPlaylistById)
  .delete(deletePlaylist);

router.post('/:id/episodes', addEpisodeToPlaylist);
router.delete('/:id/episodes/:episodeId', removeEpisodeFromPlaylist);

module.exports = router;
