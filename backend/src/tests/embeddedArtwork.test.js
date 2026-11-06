const { selectEmbeddedCover, inspectArtwork } = require('../utils/embeddedArtwork');
const png = require('./fixtures/png');
const { analyzeAudio } = require('../services/audioAnalysis');
const wav = require('./fixtures/wav');
const picture = (type, width = 10) => ({ type, format: 'image/png', data: png(width, 10) });

test('chooses the tagged front rather than the first picture', () => {
  const front = picture('Cover (front)', 20);
  const result = selectEmbeddedCover([picture('Cover (back)'), front, picture('Artist/performer')]);
  expect(Buffer.from(result.data)).toEqual(front.data);
  expect(result.mimeType).toBe('image/png');
});

test('skips ambiguous or non-cover images instead of guessing', () => {
  for (const pictures of [[], [picture('Cover (back)')], [picture('Artist/performer')], [picture('Other')], [picture(), picture()], [picture('front'), picture('front')]]) {
    expect(selectEmbeddedCover(pictures)).toBeNull();
  }
  expect(selectEmbeddedCover([picture()])).not.toBeNull();
});

test('rejects unsupported, oversized, and spoofed image data with bounded dimensions', () => {
  for (const bytes of [Buffer.from('<svg/>'), Buffer.alloc(5 * 1024 * 1024 + 1), png(8193, 1)]) {
    expect(() => inspectArtwork(bytes)).toThrow();
    expect(selectEmbeddedCover([{ type: 'front', data: bytes }])).toBeNull();
  }
});

test('real parser finds the front picture after a back picture in a tagged WAV', async () => {
  const front = png(20, 10), back = png(10, 10);
  const frame = (type, bytes) => {
    const payload = Buffer.concat([Buffer.from([0]), Buffer.from('image/png\0'), Buffer.from([type, 0]), bytes]);
    const header = Buffer.alloc(10); header.write('APIC'); header.writeUInt32BE(payload.length, 4);
    return Buffer.concat([header, payload]);
  };
  const frames = Buffer.concat([frame(4, back), frame(3, front)]);
  const header = Buffer.from([73, 68, 51, 3, 0, 0, 0, 0, 0, 0]);
  for (let i = 0; i < 4; i++) header[9 - i] = (frames.length >>> (7 * i)) & 127;
  const tag = Buffer.concat([header, frames]), chunk = Buffer.alloc(8); chunk.write('id3 '); chunk.writeUInt32LE(tag.length, 4);
  const bytes = Buffer.concat([wav(), chunk, tag, ...(tag.length % 2 ? [Buffer.alloc(1)] : [])]);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  const result = await analyzeAudio(bytes, 'Tagged.wav', 'audio/wav');
  expect(result.technical.duration).toBeCloseTo(1);
  expect(Buffer.from(result.picture.data)).toEqual(front);
}, 30000);
