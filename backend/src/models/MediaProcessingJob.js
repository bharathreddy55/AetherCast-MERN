const mongoose = require('mongoose');
const { ownerId, reference } = require('./musicFields');
const schema = new mongoose.Schema({ ownerId: ownerId(),
  sourceAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset', required: true, immutable: true },
  sourceChecksum: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  profile: { type: String, enum: ['mp3-192-v1', 'cover-320-v1'], required: true, immutable: true },
  status: { type: String, enum: ['queued', 'processing', 'ready', 'failed', 'cancelled'], default: 'queued' },
  outputAssetId: reference('MediaAsset'), error: { type: String, default: '', maxlength: 300 },
  attempts: { type: Number, default: 0, min: 0 }, leaseUntil: { type: Date, default: null }, leaseToken: { type: String, select: false },
}, { timestamps: true });
schema.index({ ownerId: 1, sourceAssetId: 1, profile: 1 }, { unique: true });
schema.index({ ownerId: 1, status: 1, leaseUntil: 1, createdAt: 1 });
module.exports = mongoose.model('MediaProcessingJob', schema);
