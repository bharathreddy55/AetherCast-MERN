jest.mock('../models/MediaAsset', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../utils/supabaseStorage', () => ({ uploadToSupabase: jest.fn(), saveFileLocally: jest.fn(),
  storageConfig: () => ({ url: 'https://test.supabase.co', headers: { Authorization: 'Bearer test-server-key' } }),
  assertPrivateBucket: jest.fn().mockResolvedValue(undefined), objectPath: (bucket, key) => `${bucket}/${key}` }));
const MediaAsset = require('../models/MediaAsset');
const { uploadToSupabase } = require('../utils/supabaseStorage');
const { storeImportAsset, readImportAsset } = require('../services/musicImportStorage');
const wav = require('./fixtures/wav');
const originalEnv = { ...process.env };
const details = { kind: 'audio', format: 'wav', mimeType: 'audio/wav', status: 'pending' };
beforeEach(() => {
  jest.clearAllMocks();
  process.env.SUPABASE_STORAGE_BUCKET = 'vox';
  MediaAsset.findOne.mockReset().mockResolvedValue(null);
  MediaAsset.create.mockReset().mockImplementation(async data => ({ _id: 'new', ...data }));
  uploadToSupabase.mockResolvedValue('supabase://vox/music-originals/new.wav');
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => { process.env = originalEnv; });

test('reuses existing owner/checksum media without uploading another object', async () => {
  const existing = { _id: 'original' };
  MediaAsset.findOne.mockResolvedValue(existing);
  expect(await storeImportAsset('owner', wav(), 'Song.wav', details)).toBe(existing);
  expect(uploadToSupabase).not.toHaveBeenCalled();
});

test('rolls back only the new storage object when duplicate asset creation races', async () => {
  const existing = { _id: 'existing' };
  MediaAsset.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
  MediaAsset.create.mockRejectedValueOnce(Object.assign(new Error('Duplicate'), { code: 11000 }));
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(Response.json([]));
  expect(await storeImportAsset('owner', wav(), 'Song.wav', details)).toBe(existing);
  expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ prefixes: ['music-originals/new.wav'] });
});

test('private source reads are bounded even if reported content length is wrong', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(Buffer.alloc(100)));
  await expect(readImportAsset({ storageProvider: 'supabase', bucket: 'vox', objectKey: 'music-originals/source.wav', byteSize: 5 }, 10)).rejects.toThrow('limit');
});

test('source reads reject local traversal before accessing another file', async () => {
  await expect(readImportAsset({ storageProvider: 'local', objectKey: '../secret', byteSize: 5 }, 10)).rejects.toThrow();
});
