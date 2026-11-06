for (const name of ['Track', 'Artist', 'TrackLike', 'ListeningEvent', 'MusicExclusion', 'TrackLyrics']) {
  jest.mock(`../models/${name}`, () => ({ find: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn(), create: jest.fn(), exists: jest.fn(), updateOne: jest.fn(), deleteOne: jest.fn(), countDocuments: jest.fn() }));
}
const Track = require('../models/Track');
const Artist = require('../models/Artist');
const TrackLyrics = require('../models/TrackLyrics');
const TrackLike = require('../models/TrackLike');
const ListeningEvent = require('../models/ListeningEvent');
const MusicExclusion = require('../models/MusicExclusion');
const { lyrics } = require('../controllers/musicLyricsController');
const recommendations = require('../controllers/musicRecommendationsController');
const ownerId = '507f1f77bcf86cd799439011', id = '507f191e810c19729de860ea';
const req = (body = {}, extra = {}) => ({ user: { _id: ownerId }, params: { id }, query: {}, method: 'PUT', body, ...extra });
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const chain = data => {
  const result = { lean: jest.fn().mockResolvedValue(data) };
  for (const method of ['sort', 'skip', 'limit', 'maxTimeMS', 'select', 'populate']) result[method] = jest.fn().mockReturnValue(result);
  return result;
};
const body = () => ({ version: 0, format: 'plain', content: 'Owner sample', source: 'My text', offsetMs: 0 });
beforeEach(() => {
  jest.resetAllMocks(); Track.exists.mockResolvedValue(true); Artist.exists.mockResolvedValue(true);
  TrackLyrics.findOne.mockReturnValue(chain(null)); TrackLyrics.create.mockImplementation(async value => value);
  Track.find.mockReturnValue(chain([])); TrackLike.find.mockReturnValue(chain([])); ListeningEvent.find.mockReturnValue(chain([])); MusicExclusion.find.mockReturnValue(chain([]));
});
test('lyrics GET defaults without exposing owner/raw fields and rejects inactive/foreign tracks', async () => {
  let response = res(); await lyrics(req({}, { method: 'GET' }), response);
  expect(Track.exists).toHaveBeenCalledWith({ ownerId, deletedAt: null, _id: id });
  expect(TrackLyrics.findOne).toHaveBeenCalledWith({ ownerId, trackId: id });
  expect(response.json.mock.calls[0][0].lyrics).toMatchObject({ version: 0, content: '' });
  Track.exists.mockResolvedValue(false); response = res(); await lyrics(req(body()), response);
  expect(response.status).toHaveBeenCalledWith(404); expect(TrackLyrics.create).not.toHaveBeenCalled();
});
test('first lyrics save uses server ownership and a unique creation conflict cannot overwrite another edit', async () => {
  let response = res(); await lyrics(req(body()), response);
  expect(TrackLyrics.create).toHaveBeenCalledWith({ ownerId, trackId: id, version: 1, format: 'plain', content: 'Owner sample', source: 'My text', offsetMs: 0 });
  expect(response.json.mock.calls[0][0].lyrics).not.toHaveProperty('ownerId');
  TrackLyrics.create.mockRejectedValue({ code: 11000 }); response = res(); await lyrics(req(body()), response);
  expect(response.status).toHaveBeenCalledWith(409); expect(TrackLyrics.findOneAndUpdate).not.toHaveBeenCalled();
});
test('lyrics update and clear require an exact owned version; clear retains a versioned tombstone', async () => {
  TrackLyrics.findOneAndUpdate.mockResolvedValue({ ...body(), version: 4 });
  let response = res(); await lyrics(req({ ...body(), version: 3 }), response);
  expect(TrackLyrics.findOneAndUpdate).toHaveBeenCalledWith({ ownerId, trackId: id, version: 3 }, expect.objectContaining({ $inc: { version: 1 } }), { new: true, runValidators: true });
  response = res(); await lyrics(req({ version: 3 }, { method: 'DELETE' }), response);
  expect(TrackLyrics.findOneAndUpdate.mock.calls[1][1].$set).toEqual({ content: '', format: 'plain', source: '', offsetMs: 0 });
  TrackLyrics.findOneAndUpdate.mockResolvedValue(null); response = res(); await lyrics(req({ ...body(), version: 3 }), response);
  expect(response.status).toHaveBeenCalledWith(409);
});
test('lyrics mass assignment and internal failures fail safely', async () => {
  let response = res(); await lyrics(req({ ...body(), ownerId: 'foreign' }), response); expect(response.status).toHaveBeenCalledWith(400);
  TrackLyrics.create.mockRejectedValue(new Error('secret database message')); response = res(); await lyrics(req(body()), response);
  expect(response.status).toHaveBeenCalledWith(500); expect(JSON.stringify(response.json.mock.calls)).not.toContain('secret');
});
test('mix loads owner-bound ready audio, bounded signals and safe explained DTOs', async () => {
  Track.find.mockReturnValue(chain([{ _id: id, title: 'Ready song', audioAssetId: { _id: id }, artistCredits: [], duration: 120, ownerId, objectKey: 'secret' }, { _id: 'unready', title: 'Unavailable', audioAssetId: null }]));
  const response = res(); await recommendations.mix(req(), response);
  expect(Track.find).toHaveBeenCalledWith({ ownerId, deletedAt: null });
  const query = Track.find.mock.results[0].value;
  expect(query.limit).toHaveBeenCalledWith(2001);
  expect(query.populate.mock.calls[0][0].at(-1)).toMatchObject({ path: 'audioAssetId', match: { ownerId, status: 'ready', kind: 'audio' } });
  expect(ListeningEvent.find.mock.calls[0][0]).toMatchObject({ ownerId, startedAt: { $gte: expect.any(Date) } });
  expect(ListeningEvent.find.mock.results[0].value.limit).toHaveBeenCalledWith(1000);
  expect(TrackLike.find).toHaveBeenCalledWith({ ownerId, trackId: { $in: [id] } });
  const result = response.json.mock.calls[0][0]; expect(result.items).toHaveLength(1); expect(result.items[0].reasons.length).toBeGreaterThan(0);
  expect(JSON.stringify(result)).not.toMatch(/secret|ownerId|objectKey|Unavailable/);
});
test('oversized libraries fail explicitly instead of silently recommending from a partial catalog', async () => {
  Track.find.mockReturnValue(chain(Array.from({ length: 2001 }, () => ({ audioAssetId: id }))));
  const response = res(); await recommendations.mix(req(), response);
  expect(response.status).toHaveBeenCalledWith(400); expect(TrackLike.find).not.toHaveBeenCalled();
});
test('exclusions can only target active owned songs/artists and save idempotently', async () => {
  const response = res(); await recommendations.exclude(req({}, { params: { id, resource: 'artists' } }), response);
  expect(Artist.exists).toHaveBeenCalledWith({ ownerId, deletedAt: null, _id: id });
  expect(MusicExclusion.updateOne).toHaveBeenCalledWith({ ownerId, kind: 'Artist', referenceId: id }, expect.any(Object), { upsert: true, runValidators: true });
  Track.exists.mockResolvedValue(false); const denied = res(); await recommendations.exclude(req({}, { params: { id, resource: 'tracks' } }), denied); expect(denied.status).toHaveBeenCalledWith(404);
  const injected = res(); await recommendations.exclude(req({ ownerId }, { params: { id, resource: 'tracks' } }), injected); expect(injected.status).toHaveBeenCalledWith(400);
});
test('exclusions list scopes population and stale/deleted exclusions can be restored by owned entry', async () => {
  MusicExclusion.find.mockReturnValue(chain([{ _id: id, kind: 'Artist', referenceId: null, ownerId }]));
  MusicExclusion.countDocuments.mockReturnValue({ maxTimeMS: jest.fn().mockResolvedValue(1) });
  const response = res(); await recommendations.listExclusions(req(), response);
  expect(MusicExclusion.find.mock.results[0].value.populate).toHaveBeenCalledWith({ path: 'referenceId', match: { ownerId, deletedAt: null }, select: 'title name' });
  expect(response.json.mock.calls[0][0].items).toEqual([{ _id: id, kind: 'Artist', name: 'Unavailable item' }]);
  await recommendations.restore(req(), res()); expect(MusicExclusion.deleteOne).toHaveBeenCalledWith({ ownerId, _id: id });
});
