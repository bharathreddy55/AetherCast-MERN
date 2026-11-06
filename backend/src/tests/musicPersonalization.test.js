const { parseLrc, lyricsInput, lyricsDto } = require('../utils/musicLyrics');
const { rankMusic } = require('../utils/musicRecommendations');
const TrackLyrics = require('../models/TrackLyrics');
const MusicExclusion = require('../models/MusicExclusion');
const ownerId = '507f1f77bcf86cd799439011', trackId = '507f191e810c19729de860ea';
const now = Date.parse('2026-11-06T00:00:00Z');
const song = (id, artist, extra = {}) => ({ _id: id, title: id, duration: 100, artistCredits: [{ artistId: artist }], genres: [], createdAt: new Date(now - 60 * 86400000), ...extra });
test('LRC parses repeated timestamps, Unicode, empty instrumental breaks and stable simultaneous lines', () => {
  expect(parseLrc('[ar:Owner]\n[00:05.250][00:01.5]నా పంక్తి\r\n[00:05.250]second\n[00:10]')).toEqual([
    { at: 1.5, text: 'నా పంక్తి' }, { at: 5.25, text: 'నా పంక్తి' }, { at: 5.25, text: 'second' }, { at: 10, text: '' },
  ]);
});
test.each(['[00:60]bad', 'untimed text', '[offset:500]\n[00:01]line', '[9999:00]too late', '[00:01]line\nforgot timestamp', '[ar:Owner]'])('invalid LRC fails instead of silently dropping text: %s', text => expect(() => parseLrc(text)).toThrow());
test('lyrics contract bounds content/lines/offsets and blocks ownership/version injection', () => {
  const body = { version: 0, content: 'Owner line\r\nSecond line', format: 'plain', offsetMs: 10, source: ' Me ' };
  expect(lyricsInput(body)).toEqual({ content: 'Owner line\nSecond line', format: 'plain', offsetMs: 10, source: 'Me' });
  for (const change of [{ ownerId }, { version: -1 }, { offsetMs: 60001 }, { offsetMs: .5 }, { offsetMs: '5' }, { format: 'html' }, { content: 'a'.repeat(50001) }, { content: 'న'.repeat(40000) }, { content: '\n'.repeat(2001) }, { source: 'x'.repeat(301) }]) expect(() => lyricsInput({ ...body, ...change })).toThrow();
  expect(lyricsDto(null)).toMatchObject({ version: 0, content: '', lines: [] });
});
test('new records define unique owner references and validate lyrics/exclusion schemas', async () => {
  await expect(new TrackLyrics({ ownerId, trackId, version: 1 }).validate()).resolves.toBeUndefined();
  await expect(new TrackLyrics({ ownerId, trackId, version: 1, offsetMs: Infinity }).validate()).rejects.toThrow();
  await expect(new MusicExclusion({ ownerId, kind: 'Track', referenceId: trackId }).validate()).resolves.toBeUndefined();
  await expect(new MusicExclusion({ ownerId, kind: 'Podcast', referenceId: trackId }).validate()).rejects.toThrow();
  expect(TrackLyrics.schema.indexes()).toContainEqual([{ ownerId: 1, trackId: 1 }, expect.objectContaining({ unique: true })]);
  expect(MusicExclusion.schema.indexes()).toContainEqual([{ ownerId: 1, kind: 1, referenceId: 1 }, expect.objectContaining({ unique: true })]);
});
test('recommendation ranking is reproducible and never invents tracks for empty/new libraries', () => {
  expect(rankMusic({ tracks: [], likes: [], events: [], exclusions: [], now })).toEqual([]);
  const tracks = [song('b', 'x'), song('a', 'y')];
  const options = { tracks, likes: [], events: [], exclusions: [], now };
  expect(rankMusic(options)).toEqual(rankMusic(options));
  expect(rankMusic(options).map(row => row.track._id)).toEqual(['a', 'b']);
  expect(rankMusic(options)[0].reasons).toContain('No plays in the sampled recent history');
});
test('likes and meaningful listening produce artist/genre evidence, seeking-to-end alone does not', () => {
  const tracks = [song('a', 'artist-a', { genres: ['ROCK'] }), song('b', 'artist-b', { genres: ['rock'] }), song('c', 'artist-a')];
  const options = { tracks, likes: [{ trackId: 'a' }], events: [{ trackId: 'c', playedSeconds: 1, outcome: 'completed', startedAt: new Date(now - 2 * 86400000) }], exclusions: [], now };
  const rows = rankMusic(options);
  expect(rows.find(row => row.track._id === 'a').reasons).toContain('Liked by you');
  expect(rows.find(row => row.track._id === 'b').reasons).toContain('Matches genres in your likes or listening');
  expect(rows.find(row => row.track._id === 'c').reasons).not.toContain('You spent time listening to this song');
  options.events[0].playedSeconds = 60;
  expect(rankMusic(options).find(row => row.track._id === 'c').reasons).toContain('You spent time listening to this song');
});
test('song and featured-artist exclusions override likes/history and do not seed preferences', () => {
  const tracks = [song('a', 'x', { artistCredits: [{ artistId: 'x' }, { artistId: 'blocked' }], genres: ['rare'] }), song('b', 'y'), song('c', 'z', { genres: ['rare'] })];
  const rows = rankMusic({ tracks, likes: [{ trackId: 'a' }], events: [{ trackId: 'a', playedSeconds: 90 }], exclusions: [{ kind: 'Artist', referenceId: 'blocked' }, { kind: 'Track', referenceId: 'b' }], now });
  expect(rows.map(row => row.track._id)).toEqual(['c']);
  expect(rows[0].reasons).not.toContain('Matches genres in your likes or listening');
});
test('quick skips/recent plays lower score; artist diversity and output bounds are explicit', () => {
  const tracks = [song('a', 'x'), song('b', 'x'), song('c', 'y')];
  const base = { tracks, likes: [], events: [], exclusions: [], now };
  expect(rankMusic(base).map(row => row.track._id)).toEqual(['a', 'c', 'b']);
  const skipped = rankMusic({ ...base, events: [{ trackId: 'a', playedSeconds: 1, outcome: 'skipped', startedAt: new Date(now) }] });
  expect(skipped.at(-1).track._id).toBe('a');
  expect(rankMusic({ ...base, limit: 1 })).toHaveLength(1);
  expect(rankMusic({ ...base, tracks: [song('a', 'x', { duration: 5 })], events: [{ trackId: 'a', playedSeconds: 3, startedAt: new Date(now) }] })[0].reasons).toContain('You spent time listening to this song');
});
