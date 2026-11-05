const Track = require('../models/Track');
const Album = require('../models/Album');
const Artist = require('../models/Artist');
const TrackLike = require('../models/TrackLike');
const SavedAlbum = require('../models/SavedAlbum');
const FollowedArtist = require('../models/FollowedArtist');
const MusicPlaylist = require('../models/MusicPlaylist');
const ListeningEvent = require('../models/ListeningEvent');
const { musicDto, id } = require('../utils/musicCatalog');
const { failure, active, exactBody, text, version, ids, pagination, population, playlistDto, playlistItems, playlistEdit } = require('../utils/musicLibrary');
const definitions = {
  likes: { Model: TrackLike, Reference: Track, field: 'trackId', resource: 'tracks' },
  albums: { Model: SavedAlbum, Reference: Album, field: 'albumId', resource: 'albums' },
  artists: { Model: FollowedArtist, Reference: Artist, field: 'artistId', resource: 'artists' },
};
const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (error) {
    const status = error.status || (error.code === 11000 ? 409 : ['ValidationError', 'CastError'].includes(error.name) ? 400 : 500);
    res.status(status).json({ success: false, message: error.status ? error.message : status === 409 ? 'A conflicting library update was detected. Refresh and try again.' : 'Unable to update your music library.' });
  }
};
const pageResponse = (items, total, options) => ({ success: true, items, total, page: options.page, limit: options.limit, totalPages: Math.ceil(total / options.limit) });
exports.state = handle(async (req, res) => {
  if (Object.keys(req.query).some(key => !['trackIds', 'albumIds', 'artistIds'].includes(key))) throw failure(400, 'Unsupported library state filter');
  const result = { success: true };
  await Promise.all(Object.entries({ trackIds: 'likes', albumIds: 'albums', artistIds: 'artists' }).map(async ([key, kind]) => {
    const value = req.query[key];
    if (value !== undefined && typeof value !== 'string') throw failure(400, 'Invalid library state filter');
    const values = value ? [...new Set(ids(value.split(','), 100))] : [];
    const { Model, field } = definitions[kind];
    result[key] = values.length ? (await Model.find({ ownerId: req.user._id, [field]: { $in: values } }).select(field).lean()).map(row => String(row[field])) : [];
  }));
  res.json(result);
});
exports.listSaved = kind => handle(async (req, res) => {
  const { Model, field, resource } = definitions[kind];
  const options = pagination(req.query), filter = { ownerId: req.user._id };
  const [rows, total] = await Promise.all([
    Model.find(filter).sort({ createdAt: -1, _id: -1 }).skip(options.skip).limit(options.limit)
      .populate({ path: field, match: active(req.user._id), populate: population(resource, req.user._id) }).lean(),
    Model.countDocuments(filter),
  ]);
  res.json(pageResponse(rows.map(row => ({ _id: row._id, savedAt: row.createdAt, unavailable: !row[field],
    referenceId: row[field]?._id || null, record: row[field] ? musicDto(resource, row[field]) : null })), total, options));
});
exports.save = kind => handle(async (req, res) => {
  exactBody(req.body || {}, []);
  const { Model, Reference, field } = definitions[kind], filter = { ownerId: req.user._id, [field]: id(req.params.id) };
  if (req.method === 'DELETE') await Model.deleteOne(filter);
  else {
    if (!await Reference.exists({ ...active(req.user._id), _id: req.params.id })) throw failure(404, 'This music record is unavailable');
    try { await Model.updateOne(filter, { $setOnInsert: filter }, { upsert: true, runValidators: true }); }
    catch (error) { if (error.code !== 11000 || !await Model.exists(filter)) throw error; }
  }
  res.json({ success: true, saved: req.method !== 'DELETE' });
});
exports.removeSavedEntry = kind => handle(async (req, res) => {
  exactBody(req.body || {}, []);
  await definitions[kind].Model.deleteOne({ ownerId: req.user._id, _id: req.params.id });
  res.json({ success: true });
});
exports.listPlaylists = handle(async (req, res) => {
  const options = pagination(req.query), filter = active(req.user._id);
  const [rows, total] = await Promise.all([
    MusicPlaylist.find(filter).select('name description version updatedAt items._id').sort({ updatedAt: -1, _id: -1 }).skip(options.skip).limit(options.limit).lean(),
    MusicPlaylist.countDocuments(filter),
  ]);
  res.json(pageResponse(rows.map(playlistDto), total, options));
});
exports.createPlaylist = handle(async (req, res) => {
  exactBody(req.body, ['name', 'description']);
  const playlist = await MusicPlaylist.create({ ownerId: req.user._id, name: text(req.body.name, 200, true),
    description: req.body.description === undefined ? '' : text(req.body.description, 2000) });
  res.status(201).json({ success: true, playlist: playlistDto(playlist) });
});
exports.getPlaylist = handle(async (req, res) => {
  const playlist = await MusicPlaylist.findOne({ ...active(req.user._id), _id: req.params.id })
    .populate({ path: 'items.trackId', match: active(req.user._id), populate: population('tracks', req.user._id) }).lean();
  if (!playlist) throw failure(404, 'Music playlist not found');
  res.json({ success: true, playlist: playlistDto(playlist), items: playlistItems(playlist) });
});
exports.editPlaylist = handle(async (req, res) => {
  const filter = { ...active(req.user._id), _id: req.params.id };
  const current = await MusicPlaylist.findOne(filter).lean();
  if (!current) throw failure(404, 'Music playlist not found');
  const changes = playlistEdit(current, req.body);
  if (current.version !== req.body.version) throw failure(409, 'This playlist changed on another device. Refresh before editing.');
  if (req.body.operation === 'add') {
    const unique = [...new Set(req.body.trackIds)];
    if (await Track.countDocuments({ ...active(req.user._id), _id: { $in: unique } }) !== unique.length) throw failure(404, 'One or more songs are unavailable');
  }
  const playlist = await MusicPlaylist.findOneAndUpdate({ ...filter, version: req.body.version },
    { $set: changes, $inc: { version: 1 } }, { new: true, runValidators: true });
  if (!playlist) throw failure(409, 'This playlist changed on another device. Refresh before editing.');
  res.json({ success: true, playlist: playlistDto(playlist) });
});
exports.deletePlaylist = handle(async (req, res) => {
  exactBody(req.body, ['version']); version(req.body.version);
  const playlist = await MusicPlaylist.findOneAndUpdate({ ...active(req.user._id), _id: req.params.id, version: req.body.version },
    { $set: { deletedAt: new Date() }, $inc: { version: 1 } }, { new: true });
  if (!playlist) throw failure(409, 'Playlist unavailable or changed. Refresh before deleting.');
  res.json({ success: true });
});
exports.recordListening = handle(async (req, res) => {
  exactBody(req.body, ['trackId', 'type', 'position', 'playedSeconds']);
  const { trackId, type, position, playedSeconds } = req.body;
  id(trackId);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(req.params.playbackId) || !['started', 'skipped', 'completed'].includes(type)
    || !Number.isFinite(position) || position < 0 || !Number.isFinite(playedSeconds) || playedSeconds < 0 || playedSeconds > 86400) throw failure(400, 'Invalid listening event');
  const track = await Track.findOne({ ...active(req.user._id), _id: trackId }).select('title duration').lean();
  if (!track) throw failure(404, 'This song is unavailable');
  if (position > track.duration + 1) throw failure(400, 'Listening position exceeds song duration');
  const filter = { ownerId: req.user._id, playbackId: req.params.playbackId, trackId };
  try {
    await ListeningEvent.updateOne(filter, { $setOnInsert: { ...filter, title: track.title, duration: track.duration,
      startedAt: new Date(), expiresAt: new Date(Date.now() + 180 * 86400000), outcome: 'started', playedSeconds: 0, position: 0 } }, { upsert: true, runValidators: true });
  } catch (error) {
    if (error.code !== 11000 || !await ListeningEvent.exists(filter)) throw error;
  }
  if (type !== 'started') await ListeningEvent.updateOne({ ...filter, outcome: type === 'completed' ? { $ne: 'completed' } : 'started' },
    { $set: { outcome: type, position: Math.min(position, track.duration), endedAt: new Date() }, $max: { playedSeconds: Math.min(playedSeconds, track.duration) } }, { runValidators: true });
  res.json({ success: true });
});
exports.history = handle(async (req, res) => {
  const options = pagination(req.query), filter = { ownerId: req.user._id };
  const [rows, total] = await Promise.all([
    ListeningEvent.find(filter).sort({ startedAt: -1, _id: -1 }).skip(options.skip).limit(options.limit)
      .populate({ path: 'trackId', match: active(req.user._id), populate: population('tracks', req.user._id) }).lean(),
    ListeningEvent.countDocuments(filter),
  ]);
  res.json(pageResponse(rows.map(row => ({ _id: row._id, title: row.title, outcome: row.outcome, playedSeconds: row.playedSeconds,
    startedAt: row.startedAt, unavailable: !row.trackId, record: row.trackId ? musicDto('tracks', row.trackId) : null })), total, options));
});
