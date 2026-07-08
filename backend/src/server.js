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
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`WebSocket client connected: ${socket.id}`);

    // Join Listening Room
    socket.on('join-room', ({ roomId, username }) => {
      socket.join(roomId);
      console.log(`${username || 'User'} (${socket.id}) joined room: ${roomId}`);
      socket.to(roomId).emit('user-joined', { username, socketId: socket.id });
    });

    // Leave Listening Room
    socket.on('leave-room', ({ roomId, username }) => {
      socket.leave(roomId);
      console.log(`${username || 'User'} left room: ${roomId}`);
      socket.to(roomId).emit('user-left', { username, socketId: socket.id });
    });

    // Playback Synchronization Events
    socket.on('sync-play', ({ roomId, username, currentTime }) => {
      console.log(`[Sync Play] ${username} in ${roomId} at ${currentTime}s`);
      socket.to(roomId).emit('sync-play', { username, currentTime });
    });

    socket.on('sync-pause', ({ roomId, username, currentTime }) => {
      console.log(`[Sync Pause] ${username} in ${roomId} at ${currentTime}s`);
      socket.to(roomId).emit('sync-pause', { username, currentTime });
    });

    socket.on('sync-seek', ({ roomId, username, currentTime }) => {
      console.log(`[Sync Seek] ${username} in ${roomId} to ${currentTime}s`);
      socket.to(roomId).emit('sync-seek', { username, currentTime });
    });

    // Chat Room messaging
    socket.on('send-message', ({ roomId, username, message, avatar }) => {
      console.log(`[Chat Msg] ${username} in ${roomId}: "${message}"`);
      socket.to(roomId).emit('receive-message', {
        username,
        message,
        avatar,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      console.log(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
  });
};

startServer();
