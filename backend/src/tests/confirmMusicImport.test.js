jest.mock('../models/MusicImport', () => ({ findOne: jest.fn() }));
jest.mock('../models/MediaAsset', () => ({ findOne: jest.fn() }));
jest.mock('../models/Artist', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../models/Album', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../models/Track', () => ({ findOne: jest.fn(), create: jest.fn() }));
const mongoose = require('mongoose');
const MusicImport = require('../models/MusicImport');
const MediaAsset = require('../models/MediaAsset');
const Artist = require('../models/Artist');
const Album = require('../models/Album');
const Track = require('../models/Track');
const { confirmMusicImport } = require('../services/confirmMusicImport');
const { extractReview } = require('../utils/musicImportMetadata');
const query = value => ({ session: jest.fn().mockResolvedValue(value) });
let session;
let job;
beforeEach(() => {
  jest.clearAllMocks();
  session = { withTransaction: jest.fn(async operation => operation()), endSession: jest.fn() };
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  job = { _id: 'job', ownerId: 'owner', assetId: 'asset', status: 'review', save: jest.fn() };
  MusicImport.findOne.mockReturnValue(query(job));
  MediaAsset.findOne.mockReturnValue(query({ _id: 'asset', duration: 180 }));
  Track.findOne.mockReturnValue(query(null));
  Artist.findOne.mockReturnValue(query(null));
  Artist.create.mockResolvedValue([{ _id: '507f191e810c19729de860ea' }]);
  Album.findOne.mockReturnValue(query(null));
  Album.create.mockResolvedValue([{ _id: 'album' }]);
  Track.create.mockResolvedValue([{ _id: 'track' }]);
});
afterEach(() => jest.restoreAllMocks());

test('confirmation scopes sources to the owner and writes all new catalog records in one transaction', async () => {
  const metadata = { ...extractReview({}, 'Song.wav'), albumTitle: 'Album' };
  const result = await confirmMusicImport('owner', 'job', metadata);
  expect(MusicImport.findOne).toHaveBeenCalledWith({ _id: 'job', ownerId: 'owner' });
  expect(MediaAsset.findOne).toHaveBeenCalledWith({ _id: 'asset', ownerId: 'owner', kind: 'audio', status: 'ready' });
  expect(Artist.create.mock.calls[0][1]).toEqual({ session });
  expect(Album.create.mock.calls[0][1]).toEqual({ session });
  expect(Track.create.mock.calls[0][1]).toEqual({ session });
  expect(Track.create.mock.calls[0][0][0]).toMatchObject({ ownerId: 'owner', duration: 180, audioAssetId: 'asset' });
  expect(job.save).toHaveBeenCalledWith({ session });
  expect(session.endSession).toHaveBeenCalled();
  expect(result).toEqual({ trackId: 'track', duplicate: false });
});

test('repeated confirmation is idempotent and does not create another track', async () => {
  job.status = 'completed'; job.trackId = 'existing';
  expect(await confirmMusicImport('owner', 'job', extractReview({}, 'Song.wav'))).toEqual({ trackId: 'existing', duplicate: true });
  expect(Track.create).not.toHaveBeenCalled();
});

test('an existing active track is reused without overwriting its edited metadata', async () => {
  Track.findOne.mockReturnValue(query({ _id: 'existing-track' }));
  const result = await confirmMusicImport('owner', 'job', extractReview({}, 'Song.wav'));
  expect(result.duplicate).toBe(true);
  expect(Track.create).not.toHaveBeenCalled();
  expect(Artist.create).not.toHaveBeenCalled();
  expect(job.trackId).toBe('existing-track');
});

test('missing/foreign jobs and unfinished audio cannot be confirmed', async () => {
  MusicImport.findOne.mockReturnValueOnce(query(null));
  await expect(confirmMusicImport('owner', 'job', extractReview({}, 'Song.wav'))).rejects.toMatchObject({ status: 404 });
  job.status = 'queued';
  await expect(confirmMusicImport('owner', 'job', extractReview({}, 'Song.wav'))).rejects.toMatchObject({ status: 409 });
  job.status = 'review'; MediaAsset.findOne.mockReturnValueOnce(query(null));
  await expect(confirmMusicImport('owner', 'job', extractReview({}, 'Song.wav'))).rejects.toMatchObject({ status: 409 });
  expect(Track.create).not.toHaveBeenCalled();
});

test('failed track writes leave the job unconfirmed and end the transaction session', async () => {
  Track.create.mockRejectedValueOnce(new Error('Database write failed'));
  await expect(confirmMusicImport('owner', 'job', extractReview({}, 'Song.wav'))).rejects.toThrow();
  expect(job.status).toBe('review');
  expect(job.save).not.toHaveBeenCalled();
  expect(session.endSession).toHaveBeenCalled();
});

test('review input cannot inject owner IDs, ready states or direct media paths', async () => {
  for (const override of [{ ownerId: 'other' }, { status: 'ready' }, { audioUrl: '/uploads/other' }]) {
    await expect(confirmMusicImport('owner', 'job', { ...extractReview({}, 'Song.wav'), ...override })).rejects.toThrow();
  }
  expect(session.withTransaction).not.toHaveBeenCalled();
});
