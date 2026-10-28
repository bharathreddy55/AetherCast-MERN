const path = require('path');
const MusicImport = require('../models/MusicImport');
const { importLimits, inspectAudio } = require('../utils/musicImportMetadata');
const { storeImportAsset } = require('../services/musicImportStorage');
const { confirmMusicImport } = require('../services/confirmMusicImport');
const dto = job => ({ _id: job._id, originalName: job.originalName, status: job.status,
  metadata: job.metadata, error: job.error || '', trackId: job.trackId || null, createdAt: job.createdAt });
const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (error) {
    const status = error.status || (error.code === 11000 ? 409 : 500);
    res.status(status).json({ success: false, message: error.status ? error.message : status === 409 ? 'This file is already being imported. Refresh the import list.' : 'Unable to complete this import. Please retry.' });
  }
};
exports.config = (_req, res) => res.json({ success: true, ...importLimits() });
exports.list = handle(async (req, res) => {
  const pending = ['queued', 'processing', 'review'];
  const [active, recent] = await Promise.all([
    MusicImport.find({ ownerId: req.user._id, status: { $in: pending } }).sort({ createdAt: 1 }).limit(50).lean(),
    MusicImport.find({ ownerId: req.user._id, status: { $nin: pending } }).sort({ updatedAt: -1 }).limit(50).lean(),
  ]);
  const jobs = [...new Map([...active, ...recent].map(job => [String(job._id), job])).values()].slice(0, 50);
  res.json({ success: true, imports: jobs.map(dto) });
});
exports.get = handle(async (req, res) => {
  const job = await MusicImport.findOne({ _id: req.params.id, ownerId: req.user._id }).lean();
  if (!job) return res.status(404).json({ success: false, message: 'Music import not found.' });
  res.json({ success: true, import: dto(job) });
});
exports.upload = handle(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Choose an audio file to import.' });
  const inspected = inspectAudio(req.file.buffer, req.file.originalname);
  const previous = await MusicImport.findOne({ ownerId: req.user._id, checksum: inspected.checksum }).lean();
  if (previous) return res.json({ success: true, duplicate: true, import: dto(previous) });
  const limit = importLimits();
  if (await MusicImport.countDocuments({ ownerId: req.user._id, status: { $in: ['queued', 'processing', 'review'] } }) >= limit.maxPending) {
    return res.status(409).json({ success: false, message: 'Review or cancel existing imports before adding more files.' });
  }
  const filename = path.basename(req.file.originalname.replace(/\\/g, '/'));
  const extension = path.extname(filename);
  const storedName = filename.length > 255 ? filename.slice(0, 255 - extension.length) + extension : filename;
  const asset = await storeImportAsset(req.user._id, req.file.buffer, storedName,
    { kind: 'audio', format: inspected.format, mimeType: inspected.mimeType, status: 'pending' });
  let job;
  try { job = await MusicImport.create({ ownerId: req.user._id, checksum: inspected.checksum, originalName: storedName, assetId: asset._id, status: 'queued' }); }
  catch (error) {
    if (error.code !== 11000) throw error;
    job = await MusicImport.findOne({ ownerId: req.user._id, checksum: inspected.checksum });
  }
  res.status(202).json({ success: true, import: dto(job) });
});
exports.confirm = handle(async (req, res) => res.json({ success: true,
  ...await confirmMusicImport(req.user._id, req.params.id, req.body) }));
exports.retry = handle(async (req, res) => {
  if (await MusicImport.countDocuments({ ownerId: req.user._id, status: { $in: ['queued', 'processing', 'review'] } }) >= importLimits().maxPending) {
    return res.status(409).json({ success: false, message: 'Review or cancel existing imports before retrying more files.' });
  }
  const job = await MusicImport.findOneAndUpdate({ _id: req.params.id, ownerId: req.user._id, status: { $in: ['failed', 'cancelled'] } },
    { $set: { status: 'queued', attempts: 0, error: '', leaseUntil: null }, $unset: { leaseToken: '' } }, { new: true });
  if (!job) return res.status(409).json({ success: false, message: 'This import is not available for retry.' });
  res.json({ success: true, import: dto(job) });
});
exports.cancel = handle(async (req, res) => {
  const job = await MusicImport.findOneAndUpdate({ _id: req.params.id, ownerId: req.user._id, status: { $in: ['queued', 'processing', 'review', 'failed'] } },
    { $set: { status: 'cancelled', leaseUntil: null }, $unset: { leaseToken: '' } }, { new: true });
  if (!job) return res.status(409).json({ success: false, message: 'This import cannot be cancelled.' });
  res.json({ success: true, import: dto(job) });
});
