const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
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
    rating: {
      type: Number,
      required: [true, 'Please provide a rating between 1 and 5'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [2000, 'Review content cannot exceed 2000 characters'],
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Unique combination of user and podcast
reviewSchema.index({ userId: 1, podcastId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
