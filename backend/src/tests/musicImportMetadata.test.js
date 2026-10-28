const { inspectAudio, extractReview, reviewInput, importLimits } = require('../utils/musicImportMetadata');
const { analyzeAudio } = require('../services/audioAnalysis');
const wavFixture = require('./fixtures/wav');

test('checks actual file signatures and fingerprints original bytes', () => {
  const bytes = wavFixture();
  const result = inspectAudio(bytes, 'original.wav');
  expect(result.format).toBe('wav');
  expect(result.mimeType).toBe('audio/wav');
  expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  expect(inspectAudio(bytes, 'renamed.wav').checksum).toBe(result.checksum);
  expect(() => inspectAudio(bytes, 'fake.mp3')).toThrow('contents');
  expect(() => inspectAudio(Buffer.from('not audio at all'), 'fake.mp3')).toThrow();
  expect(() => inspectAudio(bytes, 'fake.exe')).toThrow();
});

test('extracts bounded review metadata without splitting band names on slashes', () => {
  const value = extractReview({ title: ' Song\x00 ', artists: ['AC/DC', 'AC/DC'], album: 'Album',
    albumartists: ['Band'], year: 2026, track: { no: 7 }, disk: { no: 2 }, genre: ['Rock'] }, 'original.mp3');
  expect(value).toMatchObject({ title: 'Song', artistNames: ['AC/DC'], albumArtistNames: ['Band'], releaseDate: '2026-01-01', trackNumber: 7, discNumber: 2 });
  expect(extractReview({}, 'Untitled.wav').artistNames).toEqual(['Unknown Artist']);
  expect(extractReview({ compilation: true }, 'Track.wav').albumArtistNames).toEqual([]);
});

test('review validation rejects privileged fields and malformed metadata', () => {
  const review = extractReview({}, 'Song.wav');
  expect(reviewInput(review).title).toBe('Song');
  for (const override of [{ ownerId: 'another-user' }, { audioUrl: '/uploads/private' }, { artistNames: [] },
    { releaseDate: '2026-02-31' }, { trackNumber: 0 }, { explicit: 'true' }]) {
    expect(() => reviewInput({ ...review, ...override })).toThrow();
  }
});

test('validates configured upload limits', () => {
  const previous = process.env.MUSIC_MAX_UPLOAD_MB;
  try {
    process.env.MUSIC_MAX_UPLOAD_MB = '25'; expect(importLimits().maxBytes).toBe(25 * 1024 * 1024);
    process.env.MUSIC_MAX_UPLOAD_MB = '999'; expect(() => importLimits()).toThrow();
  } finally { if (previous === undefined) delete process.env.MUSIC_MAX_UPLOAD_MB; else process.env.MUSIC_MAX_UPLOAD_MB = previous; }
});

test('a real parser worker reads PCM WAV duration and technical metadata', async () => {
  const result = await analyzeAudio(wavFixture(), 'Sample.wav', 'audio/wav');
  expect(result.metadata.title).toBe('Sample');
  expect(result.technical.duration).toBeCloseTo(1, 3);
  expect(result.technical.sampleRate).toBe(8000);
}, 30000);

test('a real parser worker rejects truncated files that only mimic a valid signature', async () => {
  await expect(analyzeAudio(wavFixture().subarray(0, 12), 'Truncated.wav', 'audio/wav')).rejects.toThrow();
}, 30000);
