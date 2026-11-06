const fs = require('fs/promises');
const path = require('path');
const { EventEmitter } = require('events');
const { convertMedia, conversionArgs, imageSize, runFfmpeg } = require('../services/mediaConversion');
const png = require('./fixtures/png');
const wav = require('./fixtures/wav');
test('conversion accepts fixed profiles and disables shell, URL inputs and external MOV references', () => {
  const args = conversionArgs({ kind: 'audio', format: 'm4a' }, 'mp3-192-v1', 'input', 'output');
  expect(args).toEqual(expect.arrayContaining(['-protocol_whitelist', 'file,pipe', '-enable_drefs', '0', '-use_absolute_path', '-map_metadata', '-1', 'libmp3lame', '192k']));
  expect(() => conversionArgs({ kind: 'audio', format: 'm3u8' }, 'mp3-192-v1', '', '')).toThrow();
  expect(() => conversionArgs({ kind: 'image', format: 'png' }, 'custom-options', '', '')).toThrow();
});
test('image dimensions/signatures reject bad and oversized artwork before decoding', () => {
  expect(imageSize(png(), 'png')).toEqual({ width: 600, height: 400 });
  const header = png(1, 1); header.writeUInt32BE(100000, 16);
  expect(() => imageSize(header, 'png')).toThrow();
  expect(() => imageSize(Buffer.alloc(30), 'jpg')).toThrow();
});
test('subprocess never receives service credentials and timeout waits for process close', async () => {
  const child = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = jest.fn(() => { setTimeout(() => child.emit('close', null), 1); return true; });
  const spawn = jest.fn(() => child);
  await expect(runFfmpeg(['fixed'], '/temporary', { spawnImpl: spawn, timeoutMs: 5 })).rejects.toThrow('timed out');
  expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  expect(spawn.mock.calls[0][2]).toMatchObject({ shell: false, windowsHide: true, cwd: '/temporary', stdio: ['ignore', 'ignore', 'pipe'] });
  expect(Object.keys(spawn.mock.calls[0][2].env).sort()).toEqual(['PATH', ...(process.env.SystemRoot ? ['SystemRoot'] : []), 'TEMP', 'TMP'].sort());
});
test('failed conversion removes only its own temporary directory and preserves the input buffer', async () => {
  let temporary;
  const bytes = wav(), before = Buffer.from(bytes);
  await expect(convertMedia({ kind: 'audio', format: 'wav', duration: 1 }, bytes, 'mp3-192-v1', { run: async (_args, dir) => { temporary = dir; throw new Error('decoder failed'); } })).rejects.toThrow();
  expect(bytes).toEqual(before); await expect(fs.stat(temporary)).rejects.toMatchObject({ code: 'ENOENT' });
});
test('truncated/wrong-duration audio cannot be published as a compatible version', async () => {
  await expect(convertMedia({ kind: 'audio', format: 'wav', duration: 100 }, wav(), 'mp3-192-v1', {
    run: async args => fs.writeFile(args.at(-1), Buffer.alloc(10)), analyze: async () => ({ technical: { duration: 10 } }),
  })).rejects.toThrow('duration');
});
const actual = process.env.FFMPEG_PATH ? test : test.skip;
actual('real FFmpeg creates a playable MP3 with measured metadata while leaving the WAV intact', async () => {
  const bytes = wav(), before = Buffer.from(bytes);
  const result = await convertMedia({ kind: 'audio', format: 'wav', duration: 1 }, bytes, 'mp3-192-v1');
  expect(result.details).toMatchObject({ kind: 'audio', format: 'mp3', status: 'ready', bitrate: 192000, sampleRate: 44100 });
  expect(result.details.duration).toBeGreaterThan(.9); expect(result.details.duration).toBeLessThan(1.25); expect(bytes).toEqual(before);
}, 30000);
actual.each(['png', 'jpg'])('real FFmpeg fits %s artwork into 320px JPEG', async format => {
  const bytes = format === 'png' ? png() : await fs.readFile(path.resolve(__dirname, '../../../frontend/public/icon-512.png'));
  const result = await convertMedia({ kind: 'image', format }, bytes, 'cover-320-v1');
  expect(result.details.width).toBeLessThanOrEqual(320); expect(result.details.height).toBeLessThanOrEqual(320);
  expect(result.details.format).toBe('jpg'); expect(result.bytes.at(-1)).toBe(217);
}, 30000);
