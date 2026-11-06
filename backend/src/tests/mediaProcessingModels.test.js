const MediaProcessingJob = require('../models/MediaProcessingJob');
const MediaAsset = require('../models/MediaAsset');
test('processing schemas retain separate original/output identities and unique profiles', async () => {
  const job = { ownerId: '507f1f77bcf86cd799439011', sourceAssetId: '507f191e810c19729de860ea', sourceChecksum: 'a'.repeat(64), profile: 'mp3-192-v1' };
  await expect(new MediaProcessingJob(job).validate()).resolves.toBeUndefined();
  await expect(new MediaProcessingJob({ ...job, profile: 'user-command' }).validate()).rejects.toThrow();
  expect(MediaProcessingJob.schema.indexes()).toContainEqual([{ ownerId: 1, sourceAssetId: 1, profile: 1 }, expect.objectContaining({ unique: true })]);
  expect(MediaAsset.schema.path('thumbnailAssetId').options.ref).toBe('MediaAsset');
});
test('catalog returns separate signed thumbnail/full artwork without raw object keys', () => {
  const previous = process.env.MEDIA_SIGNING_SECRET;
  const previousOwner = process.env.OWNER_SUPABASE_USER_ID;
  process.env.MEDIA_SIGNING_SECRET = 'test-only-thumbnail-media-secret-123456789';
  process.env.OWNER_SUPABASE_USER_ID = '22ee4604-30c6-4efa-9bc6-b522de3770e9';
  try {
    const { musicDto } = require('../utils/musicCatalog');
    const { verifyMediaLink } = require('../utils/mediaLinks');
    const image = key => ({ _id: '507f191e810c19729de860ea', kind: 'image', status: 'ready', storageProvider: 'local', objectKey: key });
    const dto = musicDto('tracks', { _id: 'track', artistCredits: [], coverAssetId: { ...image('original.jpg'), thumbnailAssetId: image('thumbnail.jpg') } });
    expect(verifyMediaLink(dto.coverImage.slice('/media/'.length)).reference).toBe('/uploads/thumbnail.jpg');
    expect(verifyMediaLink(dto.coverFullImage.slice('/media/'.length)).reference).toBe('/uploads/original.jpg');
    expect(dto.objectKey).toBeUndefined();
  } finally {
    if (previous === undefined) delete process.env.MEDIA_SIGNING_SECRET; else process.env.MEDIA_SIGNING_SECRET = previous;
    if (previousOwner === undefined) delete process.env.OWNER_SUPABASE_USER_ID; else process.env.OWNER_SUPABASE_USER_ID = previousOwner;
  }
});
