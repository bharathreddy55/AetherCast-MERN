require('dotenv').config();
const app = require('./app');
const connectDB = async () => {
  try {
    const db = require('./config/db');
    await db();
  } catch (error) {
    console.error('Failed to connect to Database:', error.message);
  }
};

const startServer = async () => {
  // Connect to Database
  await connectDB();

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // Initialize Socket.io
  const { Server } = require('socket.io');
  const { corsOrigin, isOriginAllowed } = require('./config/security');
  const io = new Server(server, {
    cors: { origin: corsOrigin, credentials: true },
    maxHttpBufferSize: 16384,
    // WebSocket upgrades also need this check; CORS alone covers HTTP polling.
    allowRequest: (req, callback) => callback(null, isOriginAllowed(req.headers.origin)),
  });
  require('./realtime/listeningParties').attachListeningParties(io);

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
  });
};

startServer();
