jest.mock('../models/MusicImport', () => ({ exists: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/MediaAsset', () => ({ findOne: jest.fn(), updateOne: jest.fn() }));
const MusicImport = require('../models/MusicImport');
const MediaAsset = require('../models/MediaAsset');
const { processImport } = require('../services/musicImportWorker');
const { inspectAudio, extractReview } = require('../utils/musicImportMetadata');
const wavFixture = require('./fixtures/wav');
const bytes = wavFixture();
const job = { _id: 'job', ownerId: 'owner', assetId: 'asset', originalName: 'Song.wav', checksum: inspectAudio(bytes, 'Song.wav').checksum, leaseToken: 'lease' };
beforeEach(() => {
  jest.clearAllMocks();
  MediaAsset.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ _id: 'asset', byteSize: bytes.length, mimeType: 'audio/wav' }) }) });
  MusicImport.exists.mockResolvedValue(true);
});
const analyzed = () => ({ metadata: extractReview({}, 'Song.wav'), technical: { duration: 1, codec: 'PCM', sampleRate: 8000 }, picture: null });

test('processes only owned source media and completes the current job lease', async () => {
  await processImport(job, { read: async () => bytes, analyze: async () => analyzed() });
  expect(MediaAsset.findOne).toHaveBeenCalledWith({ _id: 'asset', ownerId: 'owner', kind: 'audio' });
  expect(MediaAsset.updateOne).toHaveBeenCalledWith({ _id: 'asset', ownerId: 'owner' }, { $set: expect.objectContaining({ duration: 1, status: 'ready' }) }, { runValidators: true });
  expect(MusicImport.updateOne).toHaveBeenCalledWith(expect.objectContaining({ leaseToken: 'lease', ownerId: 'owner', status: 'processing' }), expect.objectContaining({ $set: expect.objectContaining({ status: 'review' }) }));
});

test('a cancelled or replaced lease cannot resurrect an import', async () => {
  MusicImport.exists.mockResolvedValue(false);
  await processImport(job, { read: async () => bytes, analyze: async () => analyzed() });
  expect(MediaAsset.updateOne).not.toHaveBeenCalled();
  expect(MusicImport.updateOne).not.toHaveBeenCalled();
});

test('changed originals and failed parsing never create ready media', async () => {
  for (const read of [async () => Buffer.from('malformed audio'), async () => { throw new Error('secret storage detail'); }]) {
    await processImport(job, { read, analyze: async () => analyzed() });
    expect(MediaAsset.updateOne).not.toHaveBeenCalled();
    const update = MusicImport.updateOne.mock.calls.at(-1)[1];
    expect(update.$set.status).toBe('failed');
    expect(update.$set.error).not.toContain('secret');
  }
});

test('unsupported embedded artwork is ignored without discarding valid audio', async () => {
  const store = jest.fn();
  await processImport(job, { read: async () => bytes, analyze: async () => ({ ...analyzed(), picture: { data: Buffer.from('<svg>unsafe</svg>') } }), store });
  expect(store).not.toHaveBeenCalled();
  expect(MediaAsset.updateOne).toHaveBeenCalled();
});
