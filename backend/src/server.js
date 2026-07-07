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

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
  });
};

startServer();
