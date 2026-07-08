const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/podcast-stream';

    cached.promise = mongoose.connect(mongoUri, opts)
      .then((mongooseInstance) => {
        console.log(`MongoDB Connected: ${mongooseInstance.connection.host}`);
        return mongooseInstance;
      })
      .catch((error) => {
        console.error(`Database connection error: ${error.message}`);
        cached.promise = null; // Clear cached promise on failure to retry on subsequent calls
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    throw error;
  }

  return cached.conn;
};

module.exports = connectDB;
