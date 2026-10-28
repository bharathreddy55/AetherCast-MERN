const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const { protect } = require('./middlewares/auth');
const { privateMediaResponses, getMediaSecret } = require('./utils/mediaLinks');
const { deliverMedia } = require('./controllers/mediaController');
const { validateProduction, corsOrigin } = require('./config/security');

const authRoutes = require('./routes/authRoutes');
const podcastRoutes = require('./routes/podcastRoutes');
const episodeRoutes = require('./routes/episodeRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const bookmarkRoutes = require('./routes/bookmarkRoutes');
const musicRoutes = require('./routes/musicRoutes');

validateProduction();
if (process.env.NODE_ENV === 'production') getMediaSecret();
const app = express();

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const loggedUrl = req.path.startsWith('/media/') ? '/media/[redacted]' : req.path;
    console.log(`[${req.method}] ${loggedUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow streaming audios/images cross-origin
  })
);

// HTTP and Socket.io share the same explicit origin policy.
app.use(cors({ origin: corsOrigin, credentials: true }));

// Body Parsers & Cookie Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// Original files are never publicly served. Browsers use temporary scoped links.
app.use('/uploads', (_req, res) => res.sendStatus(404));
app.get('/media/:token', deliverMedia);
app.use('/api', privateMediaResponses);

// API Routes
app.use('/api/auth', authRoutes);
// All library data and operations require the configured owner, including
// routes which previously accepted guest browsing or anonymous play events.
app.use('/api', protect);
app.use('/api/music', musicRoutes);
app.use('/api/podcasts', podcastRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/bookmarks', bookmarkRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(dbStatus === 'connected' ? 200 : 500).json({
    status: 'ok',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Fallback Route
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Express Error Handler:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
