const mongoose = require('mongoose');
const { ownerId, reference } = require('./musicFields');
const schema = new mongoose.Schema({
  ownerId: ownerId(),
  name: { type: String, required: true, trim: true, maxlength: 200 },
  biography: { type: String, trim: true, maxlength: 5000, default: '' },
  imageAssetId: reference('MediaAsset'),
  deletedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ ownerId: 1, deletedAt: 1, name: 1 });
module.exports = mongoose.model('Artist', schema);
