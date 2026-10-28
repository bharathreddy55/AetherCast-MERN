const express = require('express');
const { id } = require('../utils/musicCatalog');
const controller = require('../controllers/musicController');
const router = express.Router();
router.param('id', (_req, res, next, value) => {
  try { id(value); next(); }
  catch { res.status(400).json({ success: false, message: 'Invalid music record ID' }); }
});
for (const resource of ['artists', 'albums', 'tracks']) {
  router.route(`/${resource}`).get(controller.list(resource)).post(controller.create(resource));
  router.route(`/${resource}/:id`).get(controller.get(resource)).patch(controller.update(resource)).delete(controller.remove(resource));
}
router.get('/tracks/:id/playback', controller.playback);
router.get('/assets/:id', controller.getAsset);
module.exports = router;
