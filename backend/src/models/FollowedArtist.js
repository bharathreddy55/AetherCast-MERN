const mongoose = require('mongoose');
const { ownerId } = require('./musicFields');
const schema = new mongoose.Schema({ ownerId: ownerId(), artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true } }, { timestamps: true });
schema.index({ ownerId: 1, artistId: 1 }, { unique: true });
schema.index({ ownerId: 1, createdAt: -1 });
module.exports = mongoose.model('FollowedArtist', schema);
