const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const MediaAsset = require('../models/MediaAsset');
const MediaProcessingJob = require('../models/MediaProcessingJob');
const { importLimits } = require('../utils/musicImportMetadata');
const { readImportAsset, storeImportAsset } = require('./musicImportStorage');
const { convertMedia, processingEnabled } = require('./mediaConversion');
async function processMedia(job, { read = readImportAsset, store = storeImportAsset, convert = convertMedia } = {}) {
  const lease = { _id: job._id, ownerId: job.ownerId, status: 'processing', leaseToken: job.leaseToken };
  try {
    const source = await MediaAsset.findOne({ _id: job.sourceAssetId, ownerId: job.ownerId, status: 'ready', checksum: job.sourceChecksum }).select('+objectKey').lean();
    if (!source) throw new Error('Source unavailable');
    const bytes = await read(source, source.kind === 'image' ? 5242880 : importLimits().maxBytes);
    if (bytes.length !== source.byteSize || crypto.createHash('sha256').update(bytes).digest('hex') !== job.sourceChecksum) throw new Error('Source changed');
    if (!await MediaProcessingJob.exists(lease)) return;
    const result = await convert(source, bytes, job.profile);
    if (!await MediaProcessingJob.exists(lease)) return;
    const output = await store(job.ownerId, result.bytes, result.name, { ...result.details, originalAssetId: source._id });
    if (output.kind !== source.kind || output.status !== 'ready' || output.format !== result.details.format) throw new Error('Processed asset is not ready');
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const published = await MediaProcessingJob.updateOne(lease, { $set: { status: 'ready', outputAssetId: output._id, error: '', leaseUntil: null }, $unset: { leaseToken: '' } }, { session });
        if (published.modifiedCount && job.profile === 'cover-320-v1') {
          const linked = await MediaAsset.updateOne({ _id: source._id, ownerId: job.ownerId, checksum: job.sourceChecksum }, { $set: { thumbnailAssetId: output._id } }, { runValidators: true, session });
          if (!linked.modifiedCount) throw new Error('Thumbnail source changed');
        }
      });
    } finally { await session.endSession(); }
  } catch {
    await MediaProcessingJob.updateOne(lease, { $set: { status: 'failed', error: 'Processing failed. Check FFmpeg, file limits and storage, then retry.', leaseUntil: null }, $unset: { leaseToken: '' } });
  }
}
async function runProcessingOnce() {
  const owner = await User.findOne({ supabaseUserId: process.env.OWNER_SUPABASE_USER_ID, accountStatus: { $ne: 'suspended' } }).select('_id').lean();
  if (!owner) return;
  const now = new Date();
  await MediaProcessingJob.updateMany({ ownerId: owner._id, status: 'processing', leaseUntil: { $lt: now }, attempts: { $gte: 3 } },
    { $set: { status: 'failed', error: 'Processing was interrupted. Retry this job.', leaseUntil: null }, $unset: { leaseToken: '' } });
  const job = await MediaProcessingJob.findOneAndUpdate({ ownerId: owner._id, attempts: { $lt: 3 }, $or: [{ status: 'queued' }, { status: 'processing', leaseUntil: { $lt: now } }] },
    { $set: { status: 'processing', leaseUntil: new Date(Date.now() + 600000), leaseToken: crypto.randomUUID(), error: '' }, $inc: { attempts: 1 } }, { new: true, sort: { createdAt: 1 } }).select('+leaseToken').lean();
  if (job) await processMedia(job);
}
function startMediaProcessingWorker() {
  if (!processingEnabled()) return () => {};
  let stopped = false, timer;
  const run = async () => {
    if (stopped) return;
    try { await runProcessingOnce(); } catch { console.warn('Media processing is temporarily unavailable.'); }
    if (!stopped) { timer = setTimeout(run, 3000); timer.unref(); }
  };
  void run(); return () => { stopped = true; clearTimeout(timer); };
}
module.exports = { processMedia, runProcessingOnce, startMediaProcessingWorker };
