const Artist = require('../models/Artist');
const Album = require('../models/Album');
const Track = require('../models/Track');
const MediaAsset = require('../models/MediaAsset');
const { musicInput, catalogQuery, musicDto } = require('../utils/musicCatalog');
const ownerId = '507f1f77bcf86cd799439011';
const artistId = '507f191e810c19729de860ea';
const assetId = '507f191e810c19729de860eb';
const trackInput = () => ({ title: 'A song', artistCredits: [{ artistId, role: 'primary' }], audioAssetId: assetId });

test('models require an owner and valid music metadata without any database calls', async () => {
  await expect(new Artist({ name: 'Artist' }).validate()).rejects.toThrow();
  await expect(new Artist({ ownerId, name: '  ' }).validate()).rejects.toThrow();
  await expect(new Artist({ ownerId, name: 'Artist' }).validate()).resolves.toBeUndefined();
  await expect(new Track({ ...trackInput(), ownerId, duration: 180 }).validate()).resolves.toBeUndefined();
});

test('supports collaborations, featured artists, compilations and disc/track metadata', async () => {
  const credits = [{ artistId, role: 'primary' }, { artistId: assetId, role: 'featured' }];
  await expect(new Track({ ...trackInput(), ownerId, artistCredits: credits, duration: 180, discNumber: 2, trackNumber: 10 }).validate()).resolves.toBeUndefined();
  await expect(new Album({ ownerId, title: 'Compilation', isCompilation: true }).validate()).resolves.toBeUndefined();
  await expect(new Album({ ownerId, title: 'Ordinary album', artistIds: [] }).validate()).rejects.toThrow();
});

test.each([{ duration: 0 }, { duration: Infinity }, { discNumber: 0 }, { trackNumber: 1.5 }, { artistCredits: [] }])(
  'track schema rejects invalid playback/ordering metadata: %j', async override => {
    await expect(new Track({ ...trackInput(), ownerId, duration: 180, ...override }).validate()).rejects.toThrow();
  },
);

test('ready assets require safe object keys, checksum, duration and format metadata', async () => {
  const data = { ownerId, kind: 'audio', storageProvider: 'supabase', bucket: 'vox', objectKey: 'audios/song.mp3',
    mimeType: 'audio/mpeg', format: 'mp3', byteSize: 1000, duration: 180, status: 'ready', checksum: 'a'.repeat(64) };
  await expect(new MediaAsset(data).validate()).resolves.toBeUndefined();
  for (const override of [{ objectKey: '../secret' }, { objectKey: 'https://example.test/song.mp3' }, { checksum: undefined }, { duration: 0 }, { byteSize: Infinity }, { bucket: '' }]) {
    await expect(new MediaAsset({ ...data, ...override }).validate()).rejects.toThrow();
  }
});

test('input validation rejects owner/source/status mass assignment and invalid references', () => {
  for (const extra of [{ ownerId: assetId }, { duration: 999 }, { audioUrl: 'https://example.test/song' }, { status: 'ready' }, { albumId: { $ne: null } }]) {
    expect(() => musicInput('tracks', { ...trackInput(), ...extra }, true)).toThrow();
  }
  expect(() => musicInput('tracks', { audioAssetId: assetId })).toThrow();
  expect(() => musicInput('tracks', { ...trackInput(), artistCredits: [{ artistId, role: 'featured' }] }, true)).toThrow();
  expect(() => musicInput('tracks', { ...trackInput(), artistCredits: [{ artistId }, { artistId }] }, true)).toThrow();
});

test('metadata dates, booleans, genres, and references have strict types', () => {
  expect(() => musicInput('albums', { title: 'Album', isCompilation: true, releaseDate: '2026-02-31' }, true)).toThrow();
  expect(() => musicInput('tracks', { explicit: 'true' })).toThrow();
  expect(() => musicInput('tracks', { genres: [''] })).toThrow();
  expect(musicInput('tracks', { title: '  Song ', genres: ['Rock', 'Rock'], explicit: false })).toEqual({ title: 'Song', genres: ['Rock'], explicit: false });
});

test('queries are owner-scoped, bounded, literal searches with deterministic album order', () => {
  const result = catalogQuery('tracks', { search: 'a.*[b]', albumId: assetId, artistId, page: '2', limit: '10', sort: 'album' }, ownerId);
  expect(result.filter).toMatchObject({ ownerId, deletedAt: null, albumId: assetId, 'artistCredits.artistId': artistId });
  expect(result.filter.title.$regex).toBe('a\\.\\*\\[b\\]');
  const expression = new RegExp(result.filter.title.$regex, 'i');
  expect(expression.test('a.*[b]')).toBe(true);
  expect(expression.test('axxb')).toBe(false);
  expect(result.skip).toBe(10);
  expect(result.sort).toEqual({ discNumber: 1, trackNumber: 1, _id: 1 });
  for (const query of [{ limit: '101' }, { page: '0' }, { search: { $ne: '' } }, { ownerId: assetId }, { sort: { title: 1 } }, { artistId: '' }, { albumId: '' }]) {
    expect(() => catalogQuery('tracks', query, ownerId)).toThrow();
  }
});

test('DTOs never expose owner IDs, stored object keys or arbitrary extra model fields', () => {
  const dto = musicDto('tracks', { ...trackInput(), _id: artistId, ownerId, duration: 180, objectKey: 'private-file', storageCredential: 'never-expose' });
  expect(dto.kind).toBe('track');
  expect(dto.artistCredits[0].role).toBe('primary');
  expect(dto.ownerId).toBeUndefined();
  expect(dto.objectKey).toBeUndefined();
  expect(JSON.stringify(dto)).not.toContain('never-expose');
});
