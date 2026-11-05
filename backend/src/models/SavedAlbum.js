const mongoose = require('mongoose');
const { ownerId } = require('./musicFields');
const schema = new mongoose.Schema({ ownerId: ownerId(), albumId: { type: mongoose.Schema.Types.ObjectId, ref: 'Album', required: true } }, { timestamps: true });
schema.index({ ownerId: 1, albumId: 1 }, { unique: true });
schema.index({ ownerId: 1, createdAt: -1 });
module.exports = mongoose.model('SavedAlbum', schema);
