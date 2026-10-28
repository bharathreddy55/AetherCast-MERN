const Artist = require('../models/Artist');
const Album = require('../models/Album');
const Track = require('../models/Track');
const MediaAsset = require('../models/MediaAsset');
const { musicInput, catalogQuery, musicDto, assetReference } = require('../utils/musicCatalog');
const { createMediaLink } = require('../utils/mediaLinks');
const models = { artists: Artist, albums: Album, tracks: Track };
const singular = { artists: 'artist', albums: 'album', tracks: 'track' };
const missing = message => Object.assign(new Error(message), { status: 404 });
const active = ownerId => ({ ownerId, deletedAt: null });
const handle = operation => async (req, res) => {
  try { await operation(req, res); }
  catch (error) {
    const status = error.status || (error.code === 11000 ? 409 : ['ValidationError', 'CastError'].includes(error.name) ? 400 : 500);
    const message = error.status ? error.message : status === 409 ? 'This music record already exists' : status === 400 ? 'Invalid music metadata' : 'Unable to complete this music request';
    res.status(status).json({ success: false, message });
  }
};
const populate = (resource, ownerId) => {
  const image = path => ({ path, match: { ownerId, kind: 'image', status: 'ready' }, select: '+objectKey' });
  const artists = path => ({ path, match: active(ownerId), select: 'name' });
  if (resource === 'artists') return [image('imageAssetId')];
  if (resource === 'albums') return [artists('artistIds'), image('coverAssetId')];
  return [artists('artistCredits.artistId'), image('coverAssetId'),
    { path: 'albumId', match: active(ownerId), select: 'title coverAssetId', populate: image('coverAssetId') }];
};
async function validateReferences(resource, input, ownerId) {
  const artistIds = resource === 'albums' ? input.artistIds : input.artistCredits?.map(credit => credit.artistId);
  if (artistIds?.length && await Artist.countDocuments({ ...active(ownerId), _id: { $in: artistIds } }) !== artistIds.length) throw missing('Referenced artists are unavailable');
  if (input.albumId && !await Album.exists({ ...active(ownerId), _id: input.albumId })) throw missing('Referenced album is unavailable');
  for (const field of ['coverAssetId', 'imageAssetId']) {
    if (input[field] && !await MediaAsset.exists({ ownerId, _id: input[field], kind: 'image', status: 'ready' })) throw missing('Referenced artwork is unavailable');
  }
  if (input.audioAssetId) {
    const asset = await MediaAsset.findOne({ ownerId, _id: input.audioAssetId, kind: 'audio', status: 'ready' });
    if (!asset || !Number.isFinite(asset.duration) || asset.duration <= 0) throw missing('An imported, ready audio asset is required');
    input.duration = asset.duration;
  }
}

exports.list = resource => handle(async (req, res) => {
  const options = catalogQuery(resource, req.query, req.user._id);
  const [records, total] = await Promise.all([
    models[resource].find(options.filter).populate(populate(resource, req.user._id)).sort(options.sort).skip(options.skip).limit(options.limit).lean(),
    models[resource].countDocuments(options.filter),
  ]);
  res.json({ success: true, [resource]: records.map(record => musicDto(resource, record)), page: options.page, limit: options.limit, total, totalPages: Math.ceil(total / options.limit) });
});
exports.get = resource => handle(async (req, res) => {
  const record = await models[resource].findOne({ ...active(req.user._id), _id: req.params.id }).populate(populate(resource, req.user._id)).lean();
  if (!record) throw missing('Music record not found');
  const result = { success: true, [singular[resource]]: musicDto(resource, record) };
  if (resource === 'albums') {
    const tracks = await Track.find({ ...active(req.user._id), albumId: req.params.id }).populate(populate('tracks', req.user._id)).sort({ discNumber: 1, trackNumber: 1, _id: 1 }).limit(501).lean();
    result.tracks = tracks.slice(0, 500).map(track => musicDto('tracks', track));
    result.tracksLimited = tracks.length > 500;
  }
  res.json(result);
});
exports.create = resource => handle(async (req, res) => {
  const input = musicInput(resource, req.body, true);
  await validateReferences(resource, input, req.user._id);
  const record = await models[resource].create({ ...input, ownerId: req.user._id });
  res.status(201).json({ success: true, [singular[resource]]: musicDto(resource, record) });
});
exports.update = resource => handle(async (req, res) => {
  const input = musicInput(resource, req.body);
  const record = await models[resource].findOne({ ...active(req.user._id), _id: req.params.id });
  if (!record) throw missing('Music record not found');
  await validateReferences(resource, input, req.user._id);
  Object.assign(record, input);
  await record.save();
  res.json({ success: true, [singular[resource]]: musicDto(resource, record) });
});
exports.remove = resource => handle(async (req, res) => {
  const filter = { ...active(req.user._id), _id: req.params.id };
  const record = await models[resource].findOne(filter);
  if (!record) throw missing('Music record not found');
  const referenced = resource === 'artists'
    ? await Track.exists({ ...active(req.user._id), 'artistCredits.artistId': req.params.id }) || await Album.exists({ ...active(req.user._id), artistIds: req.params.id })
    : resource === 'albums' ? await Track.exists({ ...active(req.user._id), albumId: req.params.id }) : false;
  if (referenced) throw Object.assign(new Error('Remove or reassign referenced music before deleting this record'), { status: 409 });
  record.deletedAt = new Date();
  await record.save();
  res.json({ success: true, message: 'Music record removed from the catalog. Original media is retained.' });
});
exports.playback = handle(async (req, res) => {
  const track = await Track.findOne({ ...active(req.user._id), _id: req.params.id }).populate(populate('tracks', req.user._id)).lean();
  if (!track) throw missing('Track not found');
  const asset = await MediaAsset.findOne({ _id: track.audioAssetId, ownerId: req.user._id, kind: 'audio', status: 'ready' }).select('+objectKey').lean();
  if (!asset) throw missing('Track audio is unavailable');
  res.json({ success: true, track: { ...musicDto('tracks', track), audioUrl: createMediaLink(assetReference(asset)) }, expiresIn: 900 });
});
exports.getAsset = handle(async (req, res) => {
  const asset = await MediaAsset.findOne({ _id: req.params.id, ownerId: req.user._id }).lean();
  if (!asset) throw missing('Media asset not found');
  const fields = ['_id', 'kind', 'originalName', 'mimeType', 'format', 'codec', 'byteSize', 'duration', 'bitrate', 'sampleRate', 'width', 'height', 'checksum', 'status', 'originalAssetId'];
  res.json({ success: true, asset: Object.fromEntries(fields.filter(field => asset[field] !== undefined).map(field => [field, asset[field]])) });
});
