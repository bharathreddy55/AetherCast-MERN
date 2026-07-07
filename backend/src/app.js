const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const { rateLimit } = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const podcastRoutes = require('./routes/podcastRoutes');
const episodeRoutes = require('./routes/episodeRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow streaming audios/images cross-origin
  })
);

// CORS configuration to allow credential exchange (cookies)
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);

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

// Static uploads serving
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/podcasts', podcastRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

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
