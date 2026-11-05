const mongoose = require('mongoose');
const { ownerId } = require('./musicFields');
const schema = new mongoose.Schema({ ownerId: ownerId(), playbackId: { type: String, required: true, immutable: true, maxlength: 36 },
  trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', required: true, immutable: true },
  title: { type: String, required: true, maxlength: 300 }, duration: { type: Number, required: true, min: 0 },
  outcome: { type: String, enum: ['started', 'skipped', 'completed'], default: 'started' },
  playedSeconds: { type: Number, default: 0, min: 0, max: 86400 }, position: { type: Number, default: 0, min: 0 },
  startedAt: { type: Date, default: Date.now }, endedAt: { type: Date, default: null }, expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ ownerId: 1, playbackId: 1 }, { unique: true });
schema.index({ ownerId: 1, startedAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('ListeningEvent', schema);
