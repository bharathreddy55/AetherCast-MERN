const mongoose = require('mongoose');
const { ownerId, reference } = require('./musicFields');
const schema = new mongoose.Schema({
  ownerId: ownerId(), checksum: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  originalName: { type: String, required: true, maxlength: 255 },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset', required: true },
  coverAssetId: reference('MediaAsset'), trackId: reference('Track'),
  status: { type: String, enum: ['queued', 'processing', 'review', 'completed', 'failed', 'cancelled'], default: 'queued' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  error: { type: String, default: '', maxlength: 500 },
  attempts: { type: Number, default: 0 }, leaseUntil: { type: Date, default: null },
  leaseToken: { type: String, select: false },
}, { timestamps: true });
schema.index({ ownerId: 1, checksum: 1 }, { unique: true });
schema.index({ ownerId: 1, status: 1, leaseUntil: 1, createdAt: 1 });
module.exports = mongoose.model('MusicImport', schema);
