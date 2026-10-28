const mongoose = require('mongoose');
const { ownerId, reference, finiteNumber } = require('./musicFields');
const schema = new mongoose.Schema({
  ownerId: ownerId(),
  kind: { type: String, enum: ['audio', 'image'], required: true },
  storageProvider: { type: String, enum: ['supabase', 'local'], required: true },
  bucket: { type: String, trim: true, maxlength: 100, default: '' },
  objectKey: { type: String, required: true, maxlength: 1024, select: false,
    validate: { validator: value => !/[\\%?#\x00-\x1f\x7f]/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..'), message: 'Invalid private media object key' } },
  originalName: { type: String, trim: true, maxlength: 255, default: '' },
  mimeType: { type: String, trim: true, maxlength: 100, required: true },
  format: { type: String, trim: true, lowercase: true, maxlength: 30, required: true },
  codec: { type: String, trim: true, maxlength: 80, default: '' },
  byteSize: { ...finiteNumber(1), required: true, validate: { validator: value => Number.isSafeInteger(value) && value > 0, message: 'Byte size must be a positive integer' } },
  duration: { ...finiteNumber(0), default: null },
  bitrate: finiteNumber(1), sampleRate: finiteNumber(1),
  width: finiteNumber(1), height: finiteNumber(1),
  checksum: { type: String, lowercase: true, match: /^[a-f0-9]{64}$/ },
  status: { type: String, enum: ['pending', 'processing', 'ready', 'failed'], default: 'pending' },
  originalAssetId: reference('MediaAsset'),
}, { timestamps: true });
schema.pre('validate', function () {
  if (this.storageProvider === 'supabase' && !/^[a-zA-Z0-9_-]+$/.test(this.bucket)) this.invalidate('bucket', 'A private storage bucket is required');
  if (this.status === 'ready' && (!this.checksum || (this.kind === 'audio' && !(this.duration > 0)))) this.invalidate('status', 'Ready audio needs a checksum and positive duration; ready images need a checksum');
});
schema.index({ ownerId: 1, status: 1, createdAt: -1 });
schema.index({ ownerId: 1, checksum: 1 }, { unique: true, partialFilterExpression: { checksum: { $type: 'string' } } });
module.exports = mongoose.model('MediaAsset', schema);
