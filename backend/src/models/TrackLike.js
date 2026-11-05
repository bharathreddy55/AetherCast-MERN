const mongoose = require('mongoose');
const { ownerId } = require('./musicFields');
const schema = new mongoose.Schema({ ownerId: ownerId(), trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', required: true } }, { timestamps: true });
schema.index({ ownerId: 1, trackId: 1 }, { unique: true });
schema.index({ ownerId: 1, createdAt: -1 });
module.exports = mongoose.model('TrackLike', schema);
