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
      min: 0,
      validate: { validator: Number.isFinite, message: 'Position must be finite' },
      default: 0, // In seconds
    },
    duration: {
      type: Number,
      required: true,
      validate: { validator: value => Number.isFinite(value) && value > 0, message: 'Duration must be finite and greater than zero' },
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
