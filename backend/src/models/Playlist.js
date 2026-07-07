const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide a playlist name'],
      trim: true,
      maxlength: [100, 'Playlist name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    episodes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Episode',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Playlist', playlistSchema);
