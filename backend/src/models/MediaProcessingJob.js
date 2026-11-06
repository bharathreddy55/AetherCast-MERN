const mongoose = require('mongoose');
const { ownerId, reference } = require('./musicFields');
const measured = (min, max) => ({ type: Number, min, max, required: true, validate: Number.isFinite });
const loudnessSchema = new mongoose.Schema({ mode: { type: String, enum: ['linear'], required: true },
  targetIntegratedLufs: { type: Number, enum: [-14], required: true }, maxTruePeakDbtp: { type: Number, enum: [-1], required: true },
  inputIntegratedLufs: measured(-70, 5), inputTruePeakDbtp: measured(-99, 20),
  outputIntegratedLufs: measured(-70, 5), outputTruePeakDbtp: measured(-99, -1), appliedGainDb: measured(-60, 6),
}, { _id: false });
const schema = new mongoose.Schema({ ownerId: ownerId(),
  sourceAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset', required: true, immutable: true },
  sourceChecksum: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  profile: { type: String, enum: ['mp3-192-v1', 'cover-320-v1', 'mp3-normalized-v1'], required: true, immutable: true },
  status: { type: String, enum: ['queued', 'processing', 'ready', 'failed', 'cancelled'], default: 'queued' },
  outputAssetId: reference('MediaAsset'), error: { type: String, default: '', maxlength: 300 },
  loudness: { type: loudnessSchema, default: null, required() { return this.profile === 'mp3-normalized-v1' && this.status === 'ready'; } },
  attempts: { type: Number, default: 0, min: 0 }, leaseUntil: { type: Date, default: null }, leaseToken: { type: String, select: false },
}, { timestamps: true });
schema.index({ ownerId: 1, sourceAssetId: 1, profile: 1 }, { unique: true });
schema.index({ ownerId: 1, status: 1, leaseUntil: 1, createdAt: 1 });
module.exports = mongoose.model('MediaProcessingJob', schema);
