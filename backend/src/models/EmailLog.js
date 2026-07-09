const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['signup', 'reset'],
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 3600, // TTL index: Automatically deletes document 1 hour (3600 seconds) after creation
    },
  }
);

module.exports = mongoose.model('EmailLog', emailLogSchema);
