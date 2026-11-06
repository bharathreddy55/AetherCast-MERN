const mongoose = require('mongoose');
const { ownerId } = require('./musicFields');
const schema = new mongoose.Schema({ ownerId: ownerId(), trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', required: true, immutable: true },
  content: { type: String, default: '', maxlength: 50000 }, format: { type: String, enum: ['plain', 'lrc'], default: 'plain' },
  offsetMs: { type: Number, default: 0, min: -60000, max: 60000, validate: Number.isSafeInteger },
  source: { type: String, default: '', maxlength: 300 }, version: { type: Number, required: true, min: 1 },
}, { timestamps: true });
schema.index({ ownerId: 1, trackId: 1 }, { unique: true });
module.exports = mongoose.model('TrackLyrics', schema);
