const records = require('../data/verifiedSongArtwork.json');
const { verifiedSongArtwork } = require('../utils/verifiedSongArtwork');
const { musicDto } = require('../utils/musicCatalog');
const track = record => ({ title: record.titles[0], artistCredits: [{ artistId: { name: record.artists[0] } }], albumId: { title: record.albums[0] } });

test.each(records)('matches only the verified title/artist/release for $key', record => {
  const song = track(record), art = verifiedSongArtwork(song);
  expect(art.image).toBe(`https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02${record.image}`);
  expect(art.source.url).toBe(`https://open.spotify.com/${record.source}`);
  expect(verifiedSongArtwork({ ...song, title: `${song.title} - Remix` })).toBeNull();
  expect(verifiedSongArtwork({ ...song, artistCredits: [{ artistId: { name: 'Different Artist' } }] })).toBeNull();
  expect(verifiedSongArtwork({ ...song, albumId: { title: 'Unrelated release' } })).toBeNull();
  expect(verifiedSongArtwork({ ...song, artistCredits: [{ artistId: 'unpopulated-id' }] })).toBeNull();
  expect(verifiedSongArtwork({ ...song, artistCredits: [{ role: 'featured', artistId: { name: record.artists[0] } }] })).toBeNull();
});

test('does not merge version, film, language or artist spellings through fuzzy matching', () => {
  const tamil = track(records[0]);
  expect(verifiedSongArtwork({ ...tamil, language: 'Hindi' })).toBeNull();
  expect(verifiedSongArtwork({ ...tamil, title: tamil.title.replace('[Tamil]', '[Hindi]') })).toBeNull();
  expect(verifiedSongArtwork({ ...tamil, title: 'Veezha Veera' })).toBeNull();
  expect(verifiedSongArtwork({ ...track(records[4]), title: 'God Mode' })).toBeNull();
  expect(verifiedSongArtwork({ ...track(records[2]), title: 'Kiliye Kiliye' })).toBeNull();
  expect(verifiedSongArtwork({ ...track(records[6]), albumId: { title: 'Meesaya Murukku' } })).toBeNull();
});

test('allows harmless case/typography differences and single-release album titles', () => {
  const song = track(records[3]);
  expect(verifiedSongArtwork({ ...song, title: 'PATHIKICHU (From “Vidaamuyarchi”)', albumId: { title: 'Pathikichu (From "Vidaamuyarchi") - Single' } })).not.toBeNull();
});

test('DTO supplies covers throughout library/playback without modifying database records', () => {
  const song = track(records[3]);
  const dto = musicDto('tracks', song);
  expect(dto.coverImage).toBe(verifiedSongArtwork(song).image);
  expect(dto.coverFullImage).toBe(dto.coverImage);
  expect(dto.coverSource.kind).toBe('verified-release');
  expect(song.coverImage).toBeUndefined();
  expect(musicDto('tracks', { title: 'Unknown song' }).coverImage).toBe('');
  expect(musicDto('tracks', { title: 'Unknown song' }).coverSource).toBeNull();
});

test('owner track and album artwork take priority over curated references', () => {
  const previous = process.env.MEDIA_SIGNING_SECRET;
  const previousOwner = process.env.OWNER_SUPABASE_USER_ID;
  process.env.MEDIA_SIGNING_SECRET = 'artwork-test-secret-long-enough-for-signing';
  process.env.OWNER_SUPABASE_USER_ID = '11111111-1111-4111-8111-111111111111';
  try {
    const image = { _id: 'cover', kind: 'image', status: 'ready', storageProvider: 'local', objectKey: 'front.jpg' };
    const song = track(records[3]);
    const dto = musicDto('tracks', { ...song, coverAssetId: image });
    expect(dto.coverImage).toMatch(/^\/media\//);
    expect(dto.coverSource.kind).toBe('track');
    const album = musicDto('tracks', { ...song, albumId: { ...song.albumId, coverAssetId: image } });
    expect(album.coverImage).toMatch(/^\/media\//);
    expect(album.coverSource.kind).toBe('album');
  } finally {
    if (previous === undefined) delete process.env.MEDIA_SIGNING_SECRET; else process.env.MEDIA_SIGNING_SECRET = previous;
    if (previousOwner === undefined) delete process.env.OWNER_SUPABASE_USER_ID; else process.env.OWNER_SUPABASE_USER_ID = previousOwner;
  }
});
