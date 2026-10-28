const express = require('express');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const { id } = require('../utils/musicCatalog');
const { importLimits } = require('../utils/musicImportMetadata');
const controller = require('../controllers/musicImportController');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: importLimits().maxBytes, files: 1, fields: 0 } }).single('audio');
const uploadLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many uploads. Wait before importing more files.' } });
router.param('id', (_req, res, next, value) => {
  try { id(value); next(); } catch { res.status(400).json({ success: false, message: 'Invalid import ID.' }); }
});
router.get('/config', controller.config);
router.get('/', controller.list);
router.post('/', uploadLimit, (req, res, next) => upload(req, res, error => {
  if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'This audio file exceeds the import size limit.' : 'Upload one audio file at a time.' });
  next();
}), controller.upload);
router.get('/:id', controller.get);
router.post('/:id/confirm', controller.confirm);
router.post('/:id/retry', controller.retry);
router.delete('/:id', controller.cancel);
module.exports = router;
