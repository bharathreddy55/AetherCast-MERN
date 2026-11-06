const express = require('express');
const { id } = require('../utils/musicCatalog');
const controller = require('../controllers/musicController');
const router = express.Router();
router.get('/search', require('../controllers/musicSearchController').search);
router.param('id', (_req, res, next, value) => {
  try { id(value); next(); }
  catch { res.status(400).json({ success: false, message: 'Invalid music record ID' }); }
});
for (const resource of ['artists', 'albums', 'tracks']) {
  router.route(`/${resource}`).get(controller.list(resource)).post(controller.create(resource));
  router.route(`/${resource}/:id`).get(controller.get(resource)).patch(controller.update(resource)).delete(controller.remove(resource));
}
router.get('/tracks/:id/playback', controller.playback);
router.route('/tracks/:id/processing').get(require('../controllers/mediaProcessingController').processing).post(require('../controllers/mediaProcessingController').processing);
router.delete('/processing/:id', require('../controllers/mediaProcessingController').cancel);
router.route('/tracks/:id/lyrics').get(require('../controllers/musicLyricsController').lyrics).put(require('../controllers/musicLyricsController').lyrics).delete(require('../controllers/musicLyricsController').lyrics);
router.get('/assets/:id', controller.getAsset);
module.exports = router;
