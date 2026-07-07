const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    episodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Episode',
      required: true,
    },
    position: {
      type: Number,
      required: true,
      default: 0, // In seconds
    },
    duration: {
      type: Number,
      required: true,
      default: 0, // In seconds
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

progressSchema.index({ userId: 1, episodeId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);
