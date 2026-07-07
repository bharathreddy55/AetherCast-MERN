const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema(
  {
    podcastId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Podcast',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide an episode title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide an episode description'],
    },
    audioUrl: {
      type: String,
      required: [true, 'Please provide an audio file URL'],
    },
    transcript: {
      type: String,
      default: '',
    },
    duration: {
      type: Number,
      default: 0, // duration in seconds
    },
    playCount: {
      type: Number,
      default: 0,
    },
    downloads: {
      type: Number,
      default: 0,
    },
    publishDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    likedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    aiSummary: {
      type: String,
      default: '',
    },
    aiTags: [{
      type: String,
    }],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Episode', episodeSchema);
