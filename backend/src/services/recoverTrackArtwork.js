const crypto = require('crypto');
const Track = require('../models/Track');
const MediaAsset = require('../models/MediaAsset');
const { analyzeAudio } = require('./audioAnalysis');
const { readImportAsset, storeImportAsset } = require('./musicImportStorage');
const { importLimits } = require('../utils/musicImportMetadata');
const { inspectArtwork } = require('../utils/embeddedArtwork');
const failure = (status, message) => Object.assign(new Error(message), { status });
const running = new Set();

async function recoverTrackArtwork(ownerId, trackId, { analyze = analyzeAudio, read = readImportAsset, store = storeImportAsset } = {}) {
  const key = String(ownerId);
  if (running.has(key)) throw failure(409, 'An artwork scan is already running. Wait before trying again.');
  running.add(key);
  try {
    const filter = { _id: trackId, ownerId, deletedAt: null };
    const track = await Track.findOne(filter).select('audioAssetId coverAssetId').lean();
    if (!track) throw failure(404, 'This song is unavailable.');
    if (track.coverAssetId) throw failure(409, 'This song already has its own artwork. It has been kept.');
    const asset = await MediaAsset.findOne({ _id: track.audioAssetId, ownerId, kind: 'audio', status: 'ready' }).select('+objectKey').lean();
    if (!asset) throw failure(409, 'The original audio is unavailable.');
    const bytes = await read(asset, importLimits().maxBytes);
    if (bytes.length !== asset.byteSize || crypto.createHash('sha256').update(bytes).digest('hex') !== asset.checksum) throw failure(409, 'The original audio has changed. Review the file before retrying.');
    const result = await analyze(bytes, asset.originalName, asset.mimeType);
    if (!result.picture) throw failure(422, 'No unambiguous front cover was found in this song. Its current artwork has been kept.');
    const { bytes: picture, details } = inspectArtwork(result.picture.data);
    const cover = await store(ownerId, picture, `cover.${details.format}`, details);
    const updated = await Track.updateOne({ ...filter, audioAssetId: track.audioAssetId, coverAssetId: null }, { $set: { coverAssetId: cover._id } }, { runValidators: true });
    if (updated.modifiedCount !== 1) throw failure(409, 'This song changed during the scan. Refresh before trying again.');
    return { coverAssetId: cover._id };
  } finally { running.delete(key); }
}
module.exports = { recoverTrackArtwork };
