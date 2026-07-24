const express = require('express');
const router = express.Router();
const { createBookmark, getEpisodeBookmarks, deleteBookmark } = require('../controllers/bookmarkController');
const { protect } = require('../middlewares/auth');

router.post('/', protect, createBookmark);
router.get('/episode/:episodeId', protect, getEpisodeBookmarks);
router.delete('/:id', protect, deleteBookmark);

module.exports = router;
