const Track = require('../models/Track');
const Album = require('../models/Album');
const MediaAsset = require('../models/MediaAsset');
const MediaProcessingJob = require('../models/MediaProcessingJob');
const { active, exactBody, failure } = require('../utils/musicLibrary');
const { processingEnabled } = require('../services/mediaConversion');
const dto = job => ({ _id: job._id, profile: job.profile, status: job.status, error: job.error || '', attempts: job.attempts, updatedAt: job.updatedAt });
exports.processing = async (req, res) => {
  try {
    const track = await Track.findOne({ ...active(req.user._id), _id: req.params.id }).select('audioAssetId coverAssetId albumId').lean();
    if (!track) throw failure(404, 'This song is unavailable');
    const sources = [{ _id: track.audioAssetId, profile: 'mp3-192-v1', kind: 'audio' }];
    let cover = track.coverAssetId;
    if (!cover && track.albumId) cover = (await Album.findOne({ ...active(req.user._id), _id: track.albumId }).select('coverAssetId').lean())?.coverAssetId;
    if (cover) sources.push({ _id: cover, profile: 'cover-320-v1', kind: 'image' });
    if (Object.keys(req.query).length) throw failure(400, 'Unsupported processing filter');
    if (req.method === 'POST') {
      exactBody(req.body || {}, []);
      if (!processingEnabled()) throw failure(503, 'Media processing needs an FFmpeg-enabled backend. See the media processing setup guide.');
      for (const source of sources) {
        const asset = await MediaAsset.findOne({ _id: source._id, ownerId: req.user._id, kind: source.kind, status: 'ready' }).select('checksum').lean();
        if (!asset?.checksum) throw failure(409, 'An original media asset is unavailable');
        const filter = { ownerId: req.user._id, sourceAssetId: source._id, profile: source.profile };
        const previous = await MediaProcessingJob.findOne(filter).lean();
        if (previous && previous.sourceChecksum !== asset.checksum) throw failure(409, 'The source has changed. Review its processing records before retrying.');
        if (!previous && await MediaProcessingJob.countDocuments({ ownerId: req.user._id, status: { $in: ['queued', 'processing'] } }) >= 20) throw failure(409, 'Wait for existing media jobs before preparing more songs');
        if (previous && ['failed', 'cancelled'].includes(previous.status)) await MediaProcessingJob.updateOne({ ...filter, status: previous.status }, { $set: { status: 'queued', error: '', attempts: 0, leaseUntil: null }, $unset: { leaseToken: '' } });
        else if (!previous) {
          try { await MediaProcessingJob.updateOne(filter, { $setOnInsert: { ...filter, sourceChecksum: asset.checksum, status: 'queued' } }, { upsert: true, runValidators: true }); }
          catch (error) { if (error.code !== 11000 || !await MediaProcessingJob.exists(filter)) throw error; }
        }
      }
    }
    const jobs = await MediaProcessingJob.find({ ownerId: req.user._id, sourceAssetId: { $in: sources.map(source => source._id) } }).sort({ createdAt: -1 }).limit(10).lean();
    res.json({ success: true, enabled: processingEnabled(), jobs: jobs.map(dto) });
  } catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to load or prepare media. Refresh the status before retrying.' }); }
};
exports.cancel = async (req, res) => {
  try {
    exactBody(req.body || {}, []);
    await MediaProcessingJob.updateOne({ _id: req.params.id, ownerId: req.user._id, status: { $in: ['queued', 'processing'] } }, { $set: { status: 'cancelled', leaseUntil: null }, $unset: { leaseToken: '' } });
    res.json({ success: true });
  } catch { res.status(400).json({ success: false, message: 'Unable to cancel this media job' }); }
};
