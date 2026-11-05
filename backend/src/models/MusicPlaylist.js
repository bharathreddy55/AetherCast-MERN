const mongoose = require('mongoose');
const { ownerId } = require('./musicFields');
const item = new mongoose.Schema({ trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Track', required: true },
  addedAt: { type: Date, default: Date.now } });
const schema = new mongoose.Schema({ ownerId: ownerId(), name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 2000 }, version: { type: Number, default: 0, min: 0 },
  items: { type: [item], default: [], validate: { validator: values => values.length <= 2000, message: 'At most 2000 playlist items' } },
  deletedAt: { type: Date, default: null } }, { timestamps: true });
schema.index({ ownerId: 1, deletedAt: 1, updatedAt: -1 });
module.exports = mongoose.model('MusicPlaylist', schema);
