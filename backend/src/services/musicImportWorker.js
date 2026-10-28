const crypto = require('crypto');
const User = require('../models/User');
const MusicImport = require('../models/MusicImport');
const MediaAsset = require('../models/MediaAsset');
const { inspectAudio, importLimits } = require('../utils/musicImportMetadata');
const { analyzeAudio } = require('./audioAnalysis');
const { readImportAsset, storeImportAsset } = require('./musicImportStorage');

async function processImport(job, { analyze = analyzeAudio, read = readImportAsset, store = storeImportAsset } = {}) {
  const lease = { _id: job._id, ownerId: job.ownerId, status: 'processing', leaseToken: job.leaseToken };
  try {
    const asset = await MediaAsset.findOne({ _id: job.assetId, ownerId: job.ownerId, kind: 'audio' }).select('+objectKey').lean();
    if (!asset) throw new Error('Missing source');
    const bytes = await read(asset, importLimits().maxBytes);
    const inspected = inspectAudio(bytes, job.originalName);
    if (inspected.checksum !== job.checksum || bytes.length !== asset.byteSize) throw new Error('Import source changed');
    const result = await analyze(bytes, job.originalName, asset.mimeType);
    if (!await MusicImport.exists(lease)) return;
    let coverAssetId = null;
    if (result.picture) {
      const picture = Buffer.from(result.picture.data);
      const png = picture.length >= 8 && picture.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = picture.length >= 3 && picture[0] === 255 && picture[1] === 216 && picture[2] === 255;
      if (picture.length <= 5 * 1024 * 1024 && (png || jpeg)) {
        try {
          const cover = await store(job.ownerId, picture, `cover.${png ? 'png' : 'jpg'}`, { kind: 'image', format: png ? 'png' : 'jpg', mimeType: png ? 'image/png' : 'image/jpeg', status: 'ready' });
          coverAssetId = cover._id;
        } catch { /* Artwork failure must not discard a valid original audio file. */ }
      }
    }
    if (!await MusicImport.exists(lease)) return;
    const technical = { duration: result.technical.duration, codec: result.technical.codec, status: 'ready' };
    for (const field of ['bitrate', 'sampleRate']) if (Number.isFinite(result.technical[field]) && result.technical[field] > 0) technical[field] = result.technical[field];
    await MediaAsset.updateOne({ _id: job.assetId, ownerId: job.ownerId }, { $set: technical }, { runValidators: true });
    await MusicImport.updateOne(lease, { $set: { status: 'review', metadata: result.metadata, coverAssetId, error: '', leaseUntil: null }, $unset: { leaseToken: '' } });
  } catch {
    await MusicImport.updateOne(lease, { $set: { status: 'failed', error: 'Unable to read this audio file. Retry or choose another copy.', leaseUntil: null }, $unset: { leaseToken: '' } });
  }
}

async function runImportOnce() {
  const owner = await User.findOne({ supabaseUserId: process.env.OWNER_SUPABASE_USER_ID, accountStatus: { $ne: 'suspended' } }).select('_id').lean();
  if (!owner) return;
  const now = new Date();
  await MusicImport.updateMany({ ownerId: owner._id, status: 'processing', leaseUntil: { $lt: now }, attempts: { $gte: 3 } },
    { $set: { status: 'failed', error: 'Processing was interrupted. Retry this import.', leaseUntil: null }, $unset: { leaseToken: '' } });
  const job = await MusicImport.findOneAndUpdate({ ownerId: owner._id, attempts: { $lt: 3 },
    $or: [{ status: 'queued' }, { status: 'processing', leaseUntil: { $lt: now } }] },
    { $set: { status: 'processing', error: '', leaseUntil: new Date(Date.now() + 300000), leaseToken: crypto.randomUUID() }, $inc: { attempts: 1 } },
    { new: true, sort: { createdAt: 1 } }).select('+leaseToken').lean();
  if (job) await processImport(job);
}
function startMusicImportWorker() {
  let stopped = false;
  let timer;
  const run = async () => {
    if (stopped) return;
    try { await runImportOnce(); } catch { console.warn('Music import processing is temporarily unavailable.'); }
    if (!stopped) { timer = setTimeout(run, 2000); timer.unref(); }
  };
  void run();
  return () => { stopped = true; clearTimeout(timer); };
}
module.exports = { processImport, runImportOnce, startMusicImportWorker };
