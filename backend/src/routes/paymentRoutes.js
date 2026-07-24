const express = require('express');
const router = express.Router();
const { simulateCheckout } = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');

router.post('/checkout', protect, simulateCheckout);

module.exports = router;
