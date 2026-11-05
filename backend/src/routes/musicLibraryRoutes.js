const express = require('express');
const { id } = require('../utils/musicCatalog');
const controller = require('../controllers/musicLibraryController');
const router = express.Router();
router.param('id', (_req, res, next, value) => { try { id(value); next(); } catch { res.status(400).json({ success: false, message: 'Invalid music library ID' }); } });
router.get('/state', controller.state);
for (const [path, kind] of [['likes', 'likes'], ['saved/albums', 'albums'], ['followed/artists', 'artists']]) {
  router.get(`/${path}`, controller.listSaved(kind));
  router.put(`/${path}/:id`, controller.save(kind));
  router.delete(`/${path}/:id`, controller.save(kind));
  router.delete(`/${path}/entries/:id`, controller.removeSavedEntry(kind));
}
router.get('/playlists', controller.listPlaylists);
router.post('/playlists', controller.createPlaylist);
router.get('/playlists/:id', controller.getPlaylist);
router.patch('/playlists/:id', controller.editPlaylist);
router.delete('/playlists/:id', controller.deletePlaylist);
router.put('/events/:playbackId', controller.recordListening);
router.get('/history', controller.history);
module.exports = router;
