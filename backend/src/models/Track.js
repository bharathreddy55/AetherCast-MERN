const mongoose = require('mongoose');
const { ownerId, reference, finiteNumber, positiveInteger, genres } = require('./musicFields');
const credit = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  role: { type: String, enum: ['primary', 'featured'], default: 'primary' },
}, { _id: false });
const schema = new mongoose.Schema({
  ownerId: ownerId(),
  title: { type: String, required: true, trim: true, maxlength: 300 },
  artistCredits: { type: [credit], required: true,
    validate: { validator: values => values.length > 0 && values.length <= 20 && values.some(value => value.role === 'primary'), message: 'A track needs at least one primary artist and at most 20 credits' } },
  albumId: reference('Album'),
  audioAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset', required: true },
  coverAssetId: reference('MediaAsset'),
  duration: { ...finiteNumber(0), required: true, validate: { validator: value => Number.isFinite(value) && value > 0, message: 'Track duration must be positive and finite' } },
  discNumber: positiveInteger(), trackNumber: positiveInteger(),
  releaseDate: { type: Date, default: null },
  genres: genres(),
  language: { type: String, trim: true, maxlength: 64, default: '' },
  explicit: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ ownerId: 1, deletedAt: 1, title: 1 });
schema.index({ ownerId: 1, albumId: 1, deletedAt: 1, discNumber: 1, trackNumber: 1 });
schema.index({ ownerId: 1, 'artistCredits.artistId': 1, deletedAt: 1 });
schema.index({ ownerId: 1, audioAssetId: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
module.exports = mongoose.model('Track', schema);
