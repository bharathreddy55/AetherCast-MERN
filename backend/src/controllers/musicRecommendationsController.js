const Track = require('../models/Track');
const Artist = require('../models/Artist');
const TrackLike = require('../models/TrackLike');
const ListeningEvent = require('../models/ListeningEvent');
const MusicExclusion = require('../models/MusicExclusion');
const { rankMusic } = require('../utils/musicRecommendations');
const { active, population, failure, exactBody, pagination } = require('../utils/musicLibrary');
const { musicDto } = require('../utils/musicCatalog');
const handle = operation => async (req, res) => {
  try { await operation(req, res); }
  catch (error) { res.status(error.status || (error.code === 50 ? 503 : 500)).json({ success: false, message: error.status ? error.message : 'Unable to load or update your music recommendations.' }); }
};
exports.mix = handle(async (req, res) => {
  if (Object.keys(req.query).length) throw failure(400, 'Unsupported recommendation filter');
  const ownerId = req.user._id;
  const [tracks, events, exclusions] = await Promise.all([
    Track.find(active(ownerId)).sort({ createdAt: -1, _id: -1 }).limit(2001).maxTimeMS(2000)
      .populate([...population('tracks', ownerId), { path: 'audioAssetId', match: { ownerId, status: 'ready', kind: 'audio' }, select: '_id' }]).lean(),
    ListeningEvent.find({ ownerId, startedAt: { $gte: new Date(Date.now() - 180 * 86400000) } }).sort({ startedAt: -1, _id: -1 }).limit(1000).maxTimeMS(2000).select('trackId playedSeconds outcome startedAt').lean(),
    MusicExclusion.find({ ownerId }).limit(5001).maxTimeMS(2000).select('kind referenceId').lean(),
  ]);
  if (tracks.length > 2000 || exclusions.length > 5000) throw failure(400, 'This mix version supports up to 2000 active songs and 5000 exclusions. Browse your library while larger-library mixes are developed.');
  const ready = tracks.filter(track => track.audioAssetId);
  const likes = await TrackLike.find({ ownerId, trackId: { $in: ready.map(track => track._id) } }).limit(2000).maxTimeMS(2000).select('trackId').lean();
  const items = rankMusic({ tracks: ready, likes, events, exclusions }).map(row => ({ track: musicDto('tracks', row.track), score: row.score, reasons: row.reasons }));
  res.json({ success: true, items, availableSongs: ready.length, sampledSessions: events.length, exclusionCount: exclusions.length,
    method: 'Local rules: likes, listening time, skips, recency and artist diversity. Up to 1000 sessions from the last 180 days.' });
});
exports.listExclusions = handle(async (req, res) => {
  const options = pagination(req.query), filter = { ownerId: req.user._id };
  const [rows, total] = await Promise.all([
    MusicExclusion.find(filter).sort({ createdAt: -1, _id: -1 }).skip(options.skip).limit(options.limit).maxTimeMS(2000)
      .populate({ path: 'referenceId', match: active(req.user._id), select: 'title name' }).lean(),
    MusicExclusion.countDocuments(filter).maxTimeMS(2000),
  ]);
  res.json({ success: true, items: rows.map(row => ({ _id: row._id, kind: row.kind, name: row.referenceId?.title || row.referenceId?.name || 'Unavailable item' })), page: options.page, totalPages: Math.ceil(total / options.limit) });
});
exports.exclude = handle(async (req, res) => {
  exactBody(req.body || {}, []);
  const Model = req.params.resource === 'tracks' ? Track : req.params.resource === 'artists' ? Artist : null;
  if (!Model) throw failure(400, 'Exclude a song or artist');
  if (!await Model.exists({ ...active(req.user._id), _id: req.params.id })) throw failure(404, 'This music record is unavailable');
  const filter = { ownerId: req.user._id, kind: req.params.resource === 'tracks' ? 'Track' : 'Artist', referenceId: req.params.id };
  try { await MusicExclusion.updateOne(filter, { $setOnInsert: filter }, { upsert: true, runValidators: true }); }
  catch (error) { if (error.code !== 11000 || !await MusicExclusion.exists(filter)) throw error; }
  res.json({ success: true });
});
exports.restore = handle(async (req, res) => {
  exactBody(req.body || {}, []);
  await MusicExclusion.deleteOne({ ownerId: req.user._id, _id: req.params.id });
  res.json({ success: true });
});
