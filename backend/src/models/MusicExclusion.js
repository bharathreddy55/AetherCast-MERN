const mongoose = require('mongoose');
const { ownerId } = require('./musicFields');
const schema = new mongoose.Schema({ ownerId: ownerId(), kind: { type: String, enum: ['Track', 'Artist'], required: true, immutable: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, refPath: 'kind' },
}, { timestamps: true });
schema.index({ ownerId: 1, kind: 1, referenceId: 1 }, { unique: true });
schema.index({ ownerId: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('MusicExclusion', schema);
