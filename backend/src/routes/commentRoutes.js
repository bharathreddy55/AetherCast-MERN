const express = require('express');
const router = express.Router();
const { deleteComment, flagComment } = require('../controllers/commentController');
const { protect } = require('../middlewares/auth');

router.delete('/:id', protect, deleteComment);
router.post('/:id/flag', protect, flagComment);

module.exports = router;
