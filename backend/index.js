require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

// Connect to database (Mongoose caches connection across serverless invocations)
connectDB();

module.exports = app;
