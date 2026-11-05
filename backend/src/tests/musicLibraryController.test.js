for (const model of ['Track', 'Album', 'Artist', 'TrackLike', 'SavedAlbum', 'FollowedArtist', 'MusicPlaylist', 'ListeningEvent']) {
  jest.mock(`../models/${model}`, () => ({ find: jest.fn(), findOne: jest.fn(), updateOne: jest.fn(), findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(), create: jest.fn(), exists: jest.fn(), countDocuments: jest.fn() }));
}
const Track = require('../models/Track');
const TrackLike = require('../models/TrackLike');
const SavedAlbum = require('../models/SavedAlbum');
const MusicPlaylist = require('../models/MusicPlaylist');
const ListeningEvent = require('../models/ListeningEvent');
const controller = require('../controllers/musicLibraryController');
const owner = '507f1f77bcf86cd799439011', trackId = '507f191e810c19729de860ea', playlistId = '507f191e810c19729de860eb';
const playbackId = '11111111-1111-4111-8111-111111111111';
const request = (body = {}, extra = {}) => ({ user: { _id: owner }, params: { id: playlistId, playbackId }, query: {}, body, method: 'PUT', ...extra });
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const query = data => {
  const chain = { lean: jest.fn().mockResolvedValue(data) };
  for (const method of ['select', 'populate', 'sort', 'skip', 'limit']) chain[method] = jest.fn().mockReturnValue(chain);
  return chain;
};
const playlist = () => ({ _id: playlistId, ownerId: owner, name: 'My music', description: '', version: 3, items: [] });
beforeEach(() => {
  jest.resetAllMocks();
  Track.exists.mockResolvedValue(true); Track.countDocuments.mockResolvedValue(1);
  Track.findOne.mockReturnValue(query({ _id: trackId, title: 'Song', duration: 180 }));
  MusicPlaylist.findOne.mockReturnValue(query(playlist()));
  MusicPlaylist.findOneAndUpdate.mockResolvedValue({ ...playlist(), version: 4 });
});

test('likes use authenticated ownership, trusted active references and idempotent insertion', async () => {
  const res = response();
  await controller.save('likes')(request({}, { params: { id: trackId } }), res);
  expect(Track.exists).toHaveBeenCalledWith({ ownerId: owner, deletedAt: null, _id: trackId });
  expect(TrackLike.updateOne).toHaveBeenCalledWith({ ownerId: owner, trackId }, { $setOnInsert: { ownerId: owner, trackId } }, { upsert: true, runValidators: true });
  expect(res.json).toHaveBeenCalledWith({ success: true, saved: true });
});

test('save requests reject ownership fields and missing/cross-owner references', async () => {
  const injected = response();
  await controller.save('likes')(request({ ownerId: 'someone' }), injected);
  expect(injected.status).toHaveBeenCalledWith(400);
  Track.exists.mockResolvedValue(false);
  const missing = response(); await controller.save('likes')(request(), missing);
  expect(missing.status).toHaveBeenCalledWith(404);
  expect(TrackLike.updateOne).not.toHaveBeenCalled();
});

test('unlike and removing a stale saved entry stay owner scoped without needing a live source', async () => {
  await controller.save('likes')(request({}, { method: 'DELETE', params: { id: trackId } }), response());
  expect(TrackLike.deleteOne).toHaveBeenCalledWith({ ownerId: owner, trackId });
  expect(Track.exists).not.toHaveBeenCalled();
  await controller.removeSavedEntry('albums')(request({}, { method: 'DELETE' }), response());
  expect(SavedAlbum.deleteOne).toHaveBeenCalledWith({ ownerId: owner, _id: playlistId });
});

test('concurrent like insertion succeeds only when the same owned record exists', async () => {
  TrackLike.updateOne.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
  TrackLike.exists.mockResolvedValue(true);
  const res = response(); await controller.save('likes')(request(), res);
  expect(res.json).toHaveBeenCalledWith({ success: true, saved: true });
  TrackLike.exists.mockResolvedValue(false);
  const failed = response(); await controller.save('likes')(request(), failed);
  expect(failed.status).toHaveBeenCalledWith(409);
});

test('batched like state is bounded and does not expose another owner', async () => {
  TrackLike.find.mockReturnValue(query([{ trackId }]));
  const res = response(); await controller.state(request({}, { query: { trackIds: trackId } }), res);
  expect(TrackLike.find).toHaveBeenCalledWith({ ownerId: owner, trackId: { $in: [trackId] } });
  expect(res.json).toHaveBeenCalledWith({ success: true, trackIds: [trackId], albumIds: [], artistIds: [] });
  const invalid = response(); await controller.state(request({}, { query: { trackIds: Array.from({ length: 101 }, () => trackId).join(',') } }), invalid);
  expect(invalid.status).toHaveBeenCalledWith(400);
});

test('saved lists return explicit DTOs and retain unavailable entries without unscoped population', async () => {
  const chain = query([{ _id: playlistId, trackId: null }]);
  TrackLike.find.mockReturnValue(chain); TrackLike.countDocuments.mockResolvedValue(1);
  const res = response(); await controller.listSaved('likes')(request(), res);
  expect(TrackLike.find).toHaveBeenCalledWith({ ownerId: owner });
  const spec = chain.populate.mock.calls[0][0];
  expect(spec.match).toEqual({ ownerId: owner, deletedAt: null });
  expect(spec.populate.every(value => value.match.ownerId === owner)).toBe(true);
  expect(res.json.mock.calls[0][0].items[0]).toMatchObject({ unavailable: true, record: null });
  expect(res.json.mock.calls[0][0].items[0].ownerId).toBeUndefined();
});

test('playlist creation derives the owner and rejects injected items or versions', async () => {
  MusicPlaylist.create.mockImplementation(async values => ({ ...playlist(), ...values }));
  const res = response(); await controller.createPlaylist(request({ name: 'Favorites' }), res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(MusicPlaylist.create).toHaveBeenCalledWith({ ownerId: owner, name: 'Favorites', description: '' });
  const invalid = response(); await controller.createPlaylist(request({ name: 'x', items: [] }), invalid);
  expect(invalid.status).toHaveBeenCalledWith(400);
});

test('adding repeated songs validates distinct owned references and atomically increments version', async () => {
  const res = response(); await controller.editPlaylist(request({ version: 3, operation: 'add', trackIds: [trackId, trackId] }), res);
  expect(Track.countDocuments).toHaveBeenCalledWith({ ownerId: owner, deletedAt: null, _id: { $in: [trackId] } });
  const [filter, update, options] = MusicPlaylist.findOneAndUpdate.mock.calls[0];
  expect(filter).toEqual({ ownerId: owner, deletedAt: null, _id: playlistId, version: 3 });
  expect(update.$inc.version).toBe(1);
  expect(update.$set.items).toHaveLength(2);
  expect(String(update.$set.items[0]._id)).not.toBe(String(update.$set.items[1]._id));
  expect(options.runValidators).toBe(true);
});

test('stale playlist versions and races never overwrite a newer edit', async () => {
  const res = response(); await controller.editPlaylist(request({ version: 2, operation: 'rename', name: 'new' }), res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(MusicPlaylist.findOneAndUpdate).not.toHaveBeenCalled();
  MusicPlaylist.findOneAndUpdate.mockResolvedValue(null);
  const raced = response(); await controller.editPlaylist(request({ version: 3, operation: 'rename', name: 'new' }), raced);
  expect(raced.status).toHaveBeenCalledWith(409);
});

test('playlists cannot add unavailable or foreign songs', async () => {
  Track.countDocuments.mockResolvedValue(0);
  const res = response(); await controller.editPlaylist(request({ version: 3, operation: 'add', trackIds: [trackId] }), res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(MusicPlaylist.findOneAndUpdate).not.toHaveBeenCalled();
});

test('playlist deletion is a versioned owner-only soft delete', async () => {
  await controller.deletePlaylist(request({ version: 3 }), response());
  const [filter, update] = MusicPlaylist.findOneAndUpdate.mock.calls[0];
  expect(filter).toEqual({ ownerId: owner, deletedAt: null, _id: playlistId, version: 3 });
  expect(update.$set.deletedAt).toBeInstanceOf(Date);
  expect(update.$inc).toEqual({ version: 1 });
});

test('listening starts are idempotent and do not overwrite finished outcomes', async () => {
  await controller.recordListening(request({ trackId, type: 'started', position: 0, playedSeconds: 0 }), response());
  expect(ListeningEvent.updateOne).toHaveBeenCalledTimes(1);
  const [filter, update] = ListeningEvent.updateOne.mock.calls[0];
  expect(filter).toEqual({ ownerId: owner, playbackId, trackId });
  expect(Object.keys(update)).toEqual(['$setOnInsert']);
  expect(update.$setOnInsert.title).toBe('Song');
  expect(update.$setOnInsert.expiresAt).toBeInstanceOf(Date);
});

test('completed playback cannot be downgraded by late skipped requests or duplicate starts', async () => {
  await controller.recordListening(request({ trackId, type: 'completed', position: 180, playedSeconds: 170 }), response());
  expect(ListeningEvent.updateOne.mock.calls[1][0]).toMatchObject({ ownerId: owner, outcome: { $ne: 'completed' } });
  expect(ListeningEvent.updateOne.mock.calls[1][1].$max.playedSeconds).toBe(170);
  ListeningEvent.updateOne.mockClear();
  await controller.recordListening(request({ trackId, type: 'skipped', position: 20, playedSeconds: 10 }), response());
  expect(ListeningEvent.updateOne.mock.calls[1][0].outcome).toBe('started');
});

test.each([
  { type: 'made-up', position: 0, playedSeconds: 0 }, { type: 'started', position: -1, playedSeconds: 0 },
  { type: 'completed', position: 200, playedSeconds: 0 }, { type: 'skipped', position: 1, playedSeconds: NaN },
])('invalid listening metrics are rejected: %j', async values => {
  const res = response(); await controller.recordListening(request({ trackId, ...values }), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(ListeningEvent.updateOne).not.toHaveBeenCalled();
});

test('a listening ID cannot be repurposed for a different owned track', async () => {
  ListeningEvent.updateOne.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
  ListeningEvent.exists.mockResolvedValue(false);
  const res = response(); await controller.recordListening(request({ trackId, type: 'started', position: 0, playedSeconds: 0 }), res);
  expect(res.status).toHaveBeenCalledWith(409);
});

test('history reads only owner sessions and preserves a title when a track becomes unavailable', async () => {
  const chain = query([{ _id: playlistId, title: 'Previous title', trackId: null, outcome: 'skipped', playedSeconds: 5 }]);
  ListeningEvent.find.mockReturnValue(chain); ListeningEvent.countDocuments.mockResolvedValue(1);
  const res = response(); await controller.history(request(), res);
  expect(ListeningEvent.find).toHaveBeenCalledWith({ ownerId: owner });
  expect(chain.populate.mock.calls[0][0].match).toEqual({ ownerId: owner, deletedAt: null });
  expect(res.json.mock.calls[0][0].items[0]).toMatchObject({ title: 'Previous title', unavailable: true, record: null });
});
