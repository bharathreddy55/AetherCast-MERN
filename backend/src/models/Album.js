const mongoose = require('mongoose');
const { ownerId, reference, genres } = require('./musicFields');
const schema = new mongoose.Schema({
  ownerId: ownerId(),
  title: { type: String, required: true, trim: true, maxlength: 300 },
  artistIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artist' }], default: [],
    validate: { validator(values) { return values.length <= 20 && (this.isCompilation || values.length > 0); }, message: 'Albums need artists or must be marked as compilations' } },
  isCompilation: { type: Boolean, default: false },
  coverAssetId: reference('MediaAsset'),
  releaseDate: { type: Date, default: null },
  genres: genres(),
  language: { type: String, trim: true, maxlength: 64, default: '' },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ ownerId: 1, deletedAt: 1, title: 1 });
schema.index({ ownerId: 1, artistIds: 1, deletedAt: 1 });
module.exports = mongoose.model('Album', schema);
