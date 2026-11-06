for (const name of ['Track', 'Album', 'MediaAsset', 'MediaProcessingJob', 'User']) {
  jest.mock(`../models/${name}`, () => ({ find: jest.fn(), findOne: jest.fn(), exists: jest.fn(), countDocuments: jest.fn(), updateOne: jest.fn(), updateMany: jest.fn(), findOneAndUpdate: jest.fn() }));
}
const crypto = require('crypto');
const mongoose = require('mongoose');
const Track = require('../models/Track');
const MediaAsset = require('../models/MediaAsset');
const MediaProcessingJob = require('../models/MediaProcessingJob');
const User = require('../models/User');
const controller = require('../controllers/mediaProcessingController');
const { processMedia, runProcessingOnce, startMediaProcessingWorker } = require('../services/mediaProcessingWorker');
const { playback } = require('../controllers/musicController');
const bytes = require('./fixtures/wav')();
const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
const ownerId = '507f1f77bcf86cd799439011', id = '507f191e810c19729de860ea', outputId = '507f191e810c19729de860eb';
const query = data => { const result = { lean: jest.fn().mockResolvedValue(data) }; for (const method of ['select', 'sort', 'limit', 'populate']) result[method] = jest.fn().mockReturnValue(result); return result; };
const source = () => ({ _id: id, ownerId, kind: 'audio', format: 'wav', status: 'ready', duration: 1, byteSize: bytes.length, checksum, storageProvider: 'local', objectKey: 'original.wav' });
const job = () => ({ _id: id, ownerId, sourceAssetId: id, sourceChecksum: checksum, profile: 'mp3-192-v1', status: 'processing', leaseToken: 'test-lease' });
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const request = (extra = {}) => ({ user: { _id: ownerId }, params: { id }, query: {}, body: {}, method: 'POST', ...extra });
const originalEnv = { ...process.env };
let session;
beforeEach(() => {
  jest.clearAllMocks(); process.env.MUSIC_PROCESSING_ENABLED = 'true';
  process.env.MEDIA_SIGNING_SECRET = 'test-only-processing-secret-123456789';
  process.env.OWNER_SUPABASE_USER_ID = '22ee4604-30c6-4efa-9bc6-b522de3770e9';
  session = { withTransaction: jest.fn(async operation => operation()), endSession: jest.fn().mockResolvedValue(undefined) };
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  Track.findOne.mockReturnValue(query({ _id: id, audioAssetId: id, artistCredits: [], duration: 1 }));
  MediaAsset.findOne.mockReturnValue(query(source())); MediaAsset.updateOne.mockResolvedValue({ modifiedCount: 1 });
  MediaProcessingJob.findOne.mockReturnValue(query(null)); MediaProcessingJob.find.mockReturnValue(query([]));
  MediaProcessingJob.exists.mockResolvedValue(true); MediaProcessingJob.countDocuments.mockResolvedValue(0); MediaProcessingJob.updateOne.mockResolvedValue({ modifiedCount: 1 });
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => { process.env = originalEnv; });
test('processing queue is owner-derived, source-checked, idempotent and disabled without setup', async () => {
  let res = response(); await controller.processing(request(), res);
  expect(MediaAsset.findOne).toHaveBeenCalledWith({ _id: id, ownerId, kind: 'audio', status: 'ready' });
  expect(MediaProcessingJob.updateOne).toHaveBeenCalledWith({ ownerId, sourceAssetId: id, profile: 'mp3-192-v1' }, { $setOnInsert: { ownerId, sourceAssetId: id, profile: 'mp3-192-v1', sourceChecksum: checksum, status: 'queued' } }, { upsert: true, runValidators: true });
  MediaProcessingJob.updateOne.mockClear(); MediaProcessingJob.findOne.mockReturnValue(query({ status: 'ready', sourceChecksum: checksum })); await controller.processing(request(), response()); expect(MediaProcessingJob.updateOne).not.toHaveBeenCalled();
  process.env.MUSIC_PROCESSING_ENABLED = 'false'; res = response(); await controller.processing(request(), res); expect(res.status).toHaveBeenCalledWith(503);
  expect(startMediaProcessingWorker()).toEqual(expect.any(Function));
});
test('queue rejects mass assignment, missing references and saturation; retry is status-fenced', async () => {
  const injected = response(); await controller.processing(request({ body: { ownerId: 'foreign' } }), injected); expect(injected.status).toHaveBeenCalledWith(400);
  MediaProcessingJob.countDocuments.mockResolvedValue(20); const full = response(); await controller.processing(request(), full); expect(full.status).toHaveBeenCalledWith(409);
  MediaProcessingJob.findOne.mockReturnValue(query({ status: 'failed', sourceChecksum: checksum })); await controller.processing(request(), response());
  expect(MediaProcessingJob.updateOne).toHaveBeenCalledWith(expect.objectContaining({ ownerId, status: 'failed' }), expect.objectContaining({ $set: expect.objectContaining({ attempts: 0, status: 'queued' }) }));
  Track.findOne.mockReturnValue(query(null)); const missing = response(); await controller.processing(request(), missing); expect(missing.status).toHaveBeenCalledWith(404);
});
test('worker verifies original bytes, publishes through a leased transaction and does not overwrite original audio', async () => {
  const store = jest.fn().mockResolvedValue({ _id: outputId, kind: 'audio', format: 'mp3', status: 'ready' });
  const convert = jest.fn().mockResolvedValue({ bytes: Buffer.from('new'), name: 'compatible.mp3', details: { kind: 'audio', format: 'mp3', status: 'ready', duration: 1 } });
  await processMedia(job(), { read: async () => bytes, store, convert });
  expect(convert).toHaveBeenCalledWith(expect.objectContaining({ _id: id, ownerId }), bytes, 'mp3-192-v1');
  expect(store).toHaveBeenCalledWith(ownerId, expect.any(Buffer), 'compatible.mp3', expect.objectContaining({ originalAssetId: id }));
  expect(MediaProcessingJob.updateOne).toHaveBeenCalledWith(expect.objectContaining({ ownerId, leaseToken: 'test-lease', status: 'processing' }), expect.objectContaining({ $set: expect.objectContaining({ outputAssetId: outputId, status: 'ready' }) }), { session });
  expect(MediaAsset.updateOne).not.toHaveBeenCalled(); expect(session.endSession).toHaveBeenCalled();
});
test('changed source, cancelled lease and failed decoder never publish or store an invalid derivative', async () => {
  const store = jest.fn(), convert = jest.fn();
  await processMedia(job(), { read: async () => Buffer.alloc(bytes.length), store, convert }); expect(convert).not.toHaveBeenCalled(); expect(store).not.toHaveBeenCalled();
  MediaProcessingJob.exists.mockResolvedValue(false); await processMedia(job(), { read: async () => bytes, store, convert }); expect(convert).not.toHaveBeenCalled();
  MediaProcessingJob.exists.mockResolvedValue(true); convert.mockRejectedValue(new Error('secret decoder path')); await processMedia(job(), { read: async () => bytes, store, convert });
  expect(store).not.toHaveBeenCalled(); expect(JSON.stringify(MediaProcessingJob.updateOne.mock.calls)).not.toContain('secret decoder');
});
test('thumbnail pointer and readiness publish atomically; lease loss never links the output', async () => {
  MediaAsset.findOne.mockReturnValue(query({ ...source(), kind: 'image', format: 'png' }));
  const deps = { read: async () => bytes, convert: async () => ({ bytes, name: 'thumbnail.jpg', details: { kind: 'image', format: 'jpg', status: 'ready' } }), store: async () => ({ _id: outputId, kind: 'image', format: 'jpg', status: 'ready' }) };
  await processMedia({ ...job(), profile: 'cover-320-v1' }, deps);
  expect(MediaAsset.updateOne).toHaveBeenCalledWith({ _id: id, ownerId, checksum }, { $set: { thumbnailAssetId: outputId } }, { runValidators: true, session });
  MediaAsset.updateOne.mockClear(); MediaProcessingJob.updateOne.mockResolvedValue({ modifiedCount: 0 });
  await processMedia({ ...job(), profile: 'cover-320-v1' }, deps); expect(MediaAsset.updateOne).not.toHaveBeenCalled();
});
test('expired jobs recover with a new lease and the current unsuspended owner only', async () => {
  User.findOne.mockReturnValue(query({ _id: ownerId })); MediaProcessingJob.findOneAndUpdate.mockReturnValue(query(null));
  await runProcessingOnce(); expect(User.findOne).toHaveBeenCalledWith(expect.objectContaining({ accountStatus: { $ne: 'suspended' } }));
  expect(MediaProcessingJob.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ ownerId, attempts: { $lt: 3 } });
  expect(MediaProcessingJob.updateMany.mock.calls[0][0]).toMatchObject({ ownerId, attempts: { $gte: 3 } });
});
test('compatible playback checks matching source checksum and ready owned output; never falls back', async () => {
  MediaProcessingJob.findOne.mockReturnValue(query({ outputAssetId: outputId }));
  MediaAsset.findOne.mockReturnValueOnce(query(source())).mockReturnValueOnce(query({ ...source(), _id: outputId, format: 'mp3', bitrate: 192000, objectKey: 'compatible.mp3' }));
  const res = response(); await playback(request({ query: { quality: 'compatible' } }), res);
  expect(Track.findOne.mock.results[0].value.populate.mock.calls[0][0].find(value => value.path === 'coverAssetId').populate.match).toEqual({ ownerId, kind: 'image', status: 'ready' });
  expect(MediaProcessingJob.findOne).toHaveBeenCalledWith({ ownerId, sourceAssetId: id, sourceChecksum: checksum, profile: 'mp3-192-v1', status: 'ready' });
  expect(MediaAsset.findOne.mock.calls[1][0]).toEqual({ _id: outputId, ownerId, kind: 'audio', status: 'ready', format: 'mp3' });
  expect(res.json.mock.calls[0][0].track.playback).toMatchObject({ variant: 'compatible', format: 'mp3', bitrate: 192000 });
  MediaProcessingJob.findOne.mockReturnValue(query(null)); const denied = response(); await playback(request({ query: { quality: 'compatible' } }), denied); expect(denied.status).toHaveBeenCalledWith(409);
  const injected = response(); await playback(request({ query: { quality: { $ne: null } } }), injected); expect(injected.status).toHaveBeenCalledWith(400);
});
test('cancellation cannot modify another owner or a finished job', async () => {
  await controller.cancel(request(), response()); expect(MediaProcessingJob.updateOne).toHaveBeenCalledWith({ _id: id, ownerId, status: { $in: ['queued', 'processing'] } }, expect.any(Object));
});
