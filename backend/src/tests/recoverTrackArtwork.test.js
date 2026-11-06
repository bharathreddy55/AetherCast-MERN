jest.mock('../models/Track', () => ({ findOne: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/MediaAsset', () => ({ findOne: jest.fn() }));
const crypto = require('crypto');
const Track = require('../models/Track');
const MediaAsset = require('../models/MediaAsset');
const { recoverTrackArtwork } = require('../services/recoverTrackArtwork');
const { recover } = require('../controllers/musicArtworkController');
const png = require('./fixtures/png');
const bytes = require('./fixtures/wav')();
const query = value => ({ select: () => ({ lean: async () => value }) });
let read, analyze, store;
beforeEach(() => {
  jest.clearAllMocks();
  Track.findOne.mockReturnValue(query({ audioAssetId: 'audio' }));
  Track.updateOne.mockResolvedValue({ modifiedCount: 1 });
  MediaAsset.findOne.mockReturnValue(query({ _id: 'audio', byteSize: bytes.length, checksum: crypto.createHash('sha256').update(bytes).digest('hex'), originalName: 'Song.wav', mimeType: 'audio/wav' }));
  read = jest.fn(async () => bytes); analyze = jest.fn(async () => ({ picture: { data: png() } })); store = jest.fn(async () => ({ _id: 'cover' }));
});
const run = () => recoverTrackArtwork('owner', 'track', { read, analyze, store });

test('recovers only the owned original and publishes with a no-overwrite compare-and-set', async () => {
  expect(await run()).toEqual({ coverAssetId: 'cover' });
  expect(Track.findOne).toHaveBeenCalledWith({ _id: 'track', ownerId: 'owner', deletedAt: null });
  expect(MediaAsset.findOne).toHaveBeenCalledWith({ _id: 'audio', ownerId: 'owner', kind: 'audio', status: 'ready' });
  expect(store).toHaveBeenCalledWith('owner', expect.any(Buffer), 'cover.png', expect.objectContaining({ kind: 'image', width: 600, height: 400 }));
  expect(Track.updateOne).toHaveBeenCalledWith({ _id: 'track', ownerId: 'owner', deletedAt: null, audioAssetId: 'audio', coverAssetId: null }, { $set: { coverAssetId: 'cover' } }, { runValidators: true });
});

test('existing covers and missing/foreign tracks are never replaced', async () => {
  Track.findOne.mockReturnValueOnce(query(null));
  await expect(run()).rejects.toMatchObject({ status: 404 });
  Track.findOne.mockReturnValueOnce(query({ audioAssetId: 'audio', coverAssetId: 'existing' }));
  await expect(run()).rejects.toMatchObject({ status: 409 });
  expect(read).not.toHaveBeenCalled(); expect(store).not.toHaveBeenCalled();
});

test('missing or changed originals, and absent front covers leave artwork untouched', async () => {
  MediaAsset.findOne.mockReturnValueOnce(query(null)); await expect(run()).rejects.toMatchObject({ status: 409 });
  read.mockResolvedValueOnce(Buffer.from('changed')); await expect(run()).rejects.toMatchObject({ status: 409 });
  analyze.mockResolvedValueOnce({ picture: null }); await expect(run()).rejects.toMatchObject({ status: 422 });
  expect(store).not.toHaveBeenCalled(); expect(Track.updateOne).not.toHaveBeenCalled();
});

test('a concurrent artwork edit or track deletion cannot be overwritten', async () => {
  Track.updateOne.mockResolvedValue({ modifiedCount: 0 });
  await expect(run()).rejects.toMatchObject({ status: 409 });
});

test('limits simultaneous scans per owner and releases the slot after completion', async () => {
  let release; read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const pending = run();
  // Allow the source lookup to enter the read operation.
  while (!release) await new Promise(resolve => setImmediate(resolve));
  await expect(run()).rejects.toMatchObject({ status: 409 });
  release(bytes); await pending;
  await expect(run()).resolves.toEqual({ coverAssetId: 'cover' });
});

test('controller rejects mass-assigned paths and does not expose parser/storage errors', async () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await recover({ user: { _id: 'owner' }, params: { id: 'track' }, query: {}, body: { url: 'https://arbitrary.test/cover' } }, res);
  expect(res.status).toHaveBeenCalledWith(400); expect(store).not.toHaveBeenCalled();
  Track.findOne.mockImplementationOnce(() => { throw new Error('secret storage key'); });
  await recover({ user: { _id: 'owner' }, params: { id: 'track' }, query: {}, body: {} }, res);
  expect(res.status).toHaveBeenLastCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret storage key');
});
