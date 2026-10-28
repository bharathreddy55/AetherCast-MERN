jest.mock('../models/Artist', () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../models/Album', () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), countDocuments: jest.fn(), exists: jest.fn() }));
jest.mock('../models/Track', () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), countDocuments: jest.fn(), exists: jest.fn() }));
jest.mock('../models/MediaAsset', () => ({ findOne: jest.fn(), exists: jest.fn() }));
const Artist = require('../models/Artist');
const Album = require('../models/Album');
const Track = require('../models/Track');
const MediaAsset = require('../models/MediaAsset');
const controller = require('../controllers/musicController');
const { verifyMediaLink } = require('../utils/mediaLinks');
const ownerId = '507f1f77bcf86cd799439011';
const artistId = '507f191e810c19729de860ea';
const assetId = '507f191e810c19729de860eb';
const recordId = '507f191e810c19729de860ec';
const originalEnv = { ...process.env };
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const request = (body = {}) => ({ user: { _id: ownerId }, params: { id: recordId }, query: {}, body });
const query = data => {
  const result = { lean: jest.fn().mockResolvedValue(data), then: (resolve, reject) => Promise.resolve(data).then(resolve, reject) };
  for (const method of ['populate', 'sort', 'skip', 'limit', 'select']) result[method] = jest.fn().mockReturnValue(result);
  return result;
};
const trackBody = () => ({ title: 'A song', artistCredits: [{ artistId }], audioAssetId: assetId });
beforeEach(() => {
  jest.clearAllMocks();
  process.env.OWNER_SUPABASE_USER_ID = '22ee4604-30c6-4efa-9bc6-b522de3770e9';
  process.env.MEDIA_SIGNING_SECRET = 'test-only-music-media-signing-secret-123456789';
  Artist.countDocuments.mockResolvedValue(1);
  Album.exists.mockResolvedValue(true);
  Track.exists.mockResolvedValue(false);
  MediaAsset.exists.mockResolvedValue(true);
  MediaAsset.findOne.mockReturnValue(query({ _id: assetId, kind: 'audio', status: 'ready', duration: 180,
    storageProvider: 'local', objectKey: 'song.mp3', byteSize: 1000, format: 'mp3' }));
  Track.create.mockImplementation(async data => ({ _id: recordId, ...data }));
});
afterAll(() => { process.env = originalEnv; });

test('creates a track only from owned ready audio and derives duration on the server', async () => {
  const res = response();
  await controller.create('tracks')(request(trackBody()), res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(Track.create).toHaveBeenCalledWith(expect.objectContaining({ ownerId, duration: 180, audioAssetId: assetId }));
  expect(MediaAsset.findOne).toHaveBeenCalledWith({ ownerId, _id: assetId, kind: 'audio', status: 'ready' });
  expect(Artist.countDocuments).toHaveBeenCalledWith({ ownerId, deletedAt: null, _id: { $in: [artistId] } });
});

test('rejects cross-owner artist, album and artwork references', async () => {
  Artist.countDocuments.mockResolvedValueOnce(0);
  const artistRes = response();
  await controller.create('tracks')(request(trackBody()), artistRes);
  expect(artistRes.status).toHaveBeenCalledWith(404);
  Album.exists.mockResolvedValueOnce(false);
  const albumRes = response();
  await controller.create('tracks')(request({ ...trackBody(), albumId: recordId }), albumRes);
  expect(albumRes.status).toHaveBeenCalledWith(404);
  MediaAsset.exists.mockResolvedValueOnce(false);
  const coverRes = response();
  await controller.create('tracks')(request({ ...trackBody(), coverAssetId: recordId }), coverRes);
  expect(coverRes.status).toHaveBeenCalledWith(404);
  expect(Track.create).not.toHaveBeenCalled();
});

test('pending or missing audio cannot be turned into a playable track', async () => {
  MediaAsset.findOne.mockReturnValue(query(null));
  const res = response();
  await controller.create('tracks')(request(trackBody()), res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(Track.create).not.toHaveBeenCalled();
});

test('list and population queries are always restricted to the authenticated owner', async () => {
  const chain = query([{ _id: recordId, ...trackBody(), duration: 180 }]);
  Track.find.mockReturnValue(chain);
  Track.countDocuments.mockResolvedValue(1);
  const res = response();
  await controller.list('tracks')({ ...request(), query: { limit: '10' } }, res);
  expect(Track.find).toHaveBeenCalledWith({ ownerId, deletedAt: null });
  expect(Track.countDocuments).toHaveBeenCalledWith({ ownerId, deletedAt: null });
  expect(chain.populate.mock.calls[0][0].every(spec => spec.match.ownerId === ownerId)).toBe(true);
  expect(chain.limit).toHaveBeenCalledWith(10);
  expect(res.json.mock.calls[0][0].tracks[0].ownerId).toBeUndefined();
});

test('album detail orders tracks by disc and track number with a bounded result', async () => {
  Album.findOne.mockReturnValue(query({ _id: recordId, title: 'Album', artistIds: [] }));
  const chain = query([]);
  Track.find.mockReturnValue(chain);
  await controller.get('albums')(request(), response());
  expect(Track.find).toHaveBeenCalledWith({ ownerId, deletedAt: null, albumId: recordId });
  expect(chain.sort).toHaveBeenCalledWith({ discNumber: 1, trackNumber: 1, _id: 1 });
  expect(chain.limit).toHaveBeenCalledWith(501);
});

test('updates and deletes cannot load another owner record', async () => {
  Track.findOne.mockReturnValue(query(null));
  for (const handler of [controller.update('tracks'), controller.remove('tracks')]) {
    const res = response();
    await handler(request({ title: 'Changed' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(Track.findOne).toHaveBeenCalledWith({ ownerId, deletedAt: null, _id: recordId });
  }
});

test('soft-deleting a track retains its media and referenced artists cannot be removed', async () => {
  const track = { _id: recordId, save: jest.fn().mockResolvedValue(undefined) };
  Track.findOne.mockReturnValue(query(track));
  const res = response();
  await controller.remove('tracks')(request(), res);
  expect(track.deletedAt).toBeInstanceOf(Date);
  expect(track.save).toHaveBeenCalledTimes(1);
  const artist = { save: jest.fn() };
  Artist.findOne.mockReturnValue(query(artist));
  Track.exists.mockResolvedValueOnce(true);
  const artistRes = response();
  await controller.remove('artists')(request(), artistRes);
  expect(artistRes.status).toHaveBeenCalledWith(409);
  expect(artist.save).not.toHaveBeenCalled();
});

test('playback returns a temporary link only for an owned ready asset', async () => {
  Track.findOne.mockReturnValue(query({ _id: recordId, ...trackBody(), duration: 180 }));
  const res = response();
  await controller.playback(request(), res);
  const result = res.json.mock.calls[0][0];
  expect(result.expiresIn).toBe(900);
  expect(verifyMediaLink(result.track.audioUrl.slice('/media/'.length)).reference).toBe('/uploads/song.mp3');
  expect(result.track.objectKey).toBeUndefined();
});

test('asset details expose processing metadata without storage locations', async () => {
  const res = response();
  await controller.getAsset(request(), res);
  expect(MediaAsset.findOne).toHaveBeenCalledWith({ ownerId, _id: recordId });
  const asset = res.json.mock.calls[0][0].asset;
  expect(asset.format).toBe('mp3');
  expect(asset.objectKey).toBeUndefined();
  expect(asset.storageProvider).toBeUndefined();
});

test('duplicate active tracks return conflict instead of leaking database error details', async () => {
  Track.create.mockRejectedValueOnce(Object.assign(new Error('private database detail'), { code: 11000 }));
  const res = response();
  await controller.create('tracks')(request(trackBody()), res);
  expect(res.status).toHaveBeenCalledWith(409);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('private database detail');
});
