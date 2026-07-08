const mongoose = require('mongoose');

const podcastSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a podcast title'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a podcast description'],
    },
    category: {
      type: String,
      required: [true, 'Please provide a category'],
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    language: {
      type: String,
      default: 'English',
    },
    coverImage: {
      type: String,
      default: '',
    },
    bannerImage: {
      type: String,
      default: '',
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    followersCount: {
      type: Number,
      default: 0,
    },
    episodeCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    ratingAverage: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Create slug from title before saving
podcastSchema.pre('save', async function (next) {
  if (!this.isModified('title')) {
    return next();
  }
  const baseSlug = this.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  let slug = baseSlug;
  let counter = 1;
  const Podcast = mongoose.model('Podcast');

  while (await Podcast.exists({ slug, _id: { $ne: this._id } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  this.slug = slug;
  next();
});

module.exports = mongoose.model('Podcast', podcastSchema);
