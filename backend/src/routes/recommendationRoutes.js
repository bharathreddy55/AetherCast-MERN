const express = require('express');
const router = express.Router();
const { getRecommendations } = require('../controllers/recommendationController');
const { protect } = require('../middlewares/auth');

router.get('/', protect, getRecommendations);

module.exports = router;
