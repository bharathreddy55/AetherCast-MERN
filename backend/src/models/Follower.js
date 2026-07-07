const mongoose = require('mongoose');

const followerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    podcastId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Podcast',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can follow a podcast only once
followerSchema.index({ userId: 1, podcastId: 1 }, { unique: true });

module.exports = mongoose.model('Follower', followerSchema);
