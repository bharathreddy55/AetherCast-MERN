const fs = require('fs/promises');
const { EventEmitter } = require('events');
const { normalizeAudio, parseLoudness, normalizationGain, measurementArgs } = require('../services/audioNormalization');
const { runFfmpeg } = require('../services/mediaConversion');
const { loudnessDto } = require('../utils/musicLoudness');
const MediaProcessingJob = require('../models/MediaProcessingJob');
const wav = require('./fixtures/wav');
const log = (i = '-8.00', tp = '-3.00') => `encoder output\n${JSON.stringify({ input_i: i, input_tp: tp, output_i: '-14.0' })}\n`;
const metrics = () => ({ mode: 'linear', targetIntegratedLufs: -14, maxTruePeakDbtp: -1, appliedGainDb: -6,
  inputIntegratedLufs: -8, inputTruePeakDbtp: -3, outputIntegratedLufs: -14.2, outputTruePeakDbtp: -9.1 });
const source = { kind: 'audio', format: 'wav', duration: 1 };

test('parses only finite measured input values and rejects silence, spoofing and oversized logs', () => {
  expect(parseLoudness(log())).toEqual({ integratedLufs: -8, truePeakDbtp: -3 });
  for (const value of [log('-inf'), log('NaN'), log('0;volume=100'), log('100'), log('-8', '99'), log() + log(), 'missing', 'x'.repeat(65537), JSON.stringify({ input_i: -8, input_tp: -3 })]) expect(() => parseLoudness(value)).toThrow();
});

test('fixed gain respects the loudness target, peak headroom and six-decibel boost cap', () => {
  expect(normalizationGain({ integratedLufs: -8, truePeakDbtp: -3 })).toBe(-6);
  expect(normalizationGain({ integratedLufs: -40, truePeakDbtp: -30 })).toBe(6);
  expect(normalizationGain({ integratedLufs: -25, truePeakDbtp: -1 })).toBe(-1);
  expect(() => normalizationGain({ integratedLufs: Infinity, truePeakDbtp: 0 })).toThrow();
});

test('measurement commands keep fixed local input restrictions and a null output', () => {
  const args = measurementArgs({ kind: 'audio', format: 'm4a' }, 'source.bin');
  expect(args).toEqual(expect.arrayContaining(['-protocol_whitelist', 'file,pipe', '-enable_drefs', '0', '-use_absolute_path', '0', '-filter_threads', '1']));
  expect(args.slice(-3)).toEqual(['-f', 'null', '-']);
  expect(() => measurementArgs({ kind: 'audio', format: 'm3u8' }, 'input')).toThrow();
});

test('encodes separate bytes, verifies decoded MP3 loudness, and removes only its temporary directory', async () => {
  let calls = 0, directory; const original = wav(), before = Buffer.from(original);
  const result = await normalizeAudio(source, original, { run: async (args, dir, options) => {
    directory = dir; calls++;
    expect(options.timeoutMs).toBe(120000);
    if (calls === 1) return log();
    if (calls === 2) { expect(args).toContain('aformat=channel_layouts=stereo,aresample=44100,volume=-6dB'); return fs.writeFile(args.at(-1), Buffer.from('encoded MP3')); }
    expect(args).toContain('mp3'); return log('-14.20', '-9.10');
  }, analyze: async () => ({ technical: { duration: 1, bitrate: 192000, sampleRate: 44100, codec: 'MP3' } }) });
  expect(calls).toBe(3); expect(result.loudness).toEqual(metrics()); expect(result.details.format).toBe('mp3');
  expect(original).toEqual(before); await expect(fs.stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('encoded peak violations, invalid duration and failed measurement cannot produce a normalized result', async () => {
  for (const mode of ['peak', 'duration', 'silence']) {
    let call = 0, dir;
    await expect(normalizeAudio(source, wav(), { run: async (args, cwd) => {
      dir = cwd; call++;
      if (call === 1) return mode === 'silence' ? log('-inf') : log();
      if (call === 2) return fs.writeFile(args.at(-1), Buffer.from('output'));
      return log('-14.00', '-0.50');
    }, analyze: async () => ({ technical: { duration: mode === 'duration' ? 100 : 1 } }) })).rejects.toThrow();
    await expect(fs.stat(dir)).rejects.toMatchObject({ code: 'ENOENT' });
  }
});

test('bounded captured stderr never receives environment secrets and overflowing logs fail', async () => {
  for (const overflow of [false, true]) {
    const child = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = jest.fn(() => { setImmediate(() => child.emit('close', 1)); return true; });
    const spawn = jest.fn(() => { setImmediate(() => { child.stderr.emit('data', Buffer.from(overflow ? 'x'.repeat(65537) : 'measurement')); if (!overflow) child.emit('close', 0); }); return child; });
    const result = runFfmpeg(['fixed'], '/temporary', { spawnImpl: spawn, captureStderr: true });
    if (overflow) await expect(result).rejects.toThrow(); else await expect(result).resolves.toBe('measurement');
    expect(spawn.mock.calls[0][2].env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(spawn.mock.calls[0][2].shell).toBe(false);
  }
});

test('safe measurement DTOs and job validation reject missing/nonfinite or peak-unsafe data', async () => {
  expect(loudnessDto({ ...metrics(), privateLog: 'secret' })).toEqual(metrics());
  for (const patch of [{ appliedGainDb: 7 }, { outputTruePeakDbtp: -.5 }, { outputIntegratedLufs: NaN }, { mode: 'dynamic' }]) expect(loudnessDto({ ...metrics(), ...patch })).toBeNull();
  const job = { ownerId: '507f1f77bcf86cd799439011', sourceAssetId: '507f191e810c19729de860ea', sourceChecksum: 'a'.repeat(64), profile: 'mp3-normalized-v1', status: 'ready' };
  await expect(new MediaProcessingJob(job).validate()).rejects.toThrow();
  await expect(new MediaProcessingJob({ ...job, loudness: metrics() }).validate()).resolves.toBeUndefined();
});

const actual = process.env.FFMPEG_PATH ? test : test.skip;
const sine = amplitude => {
  const original = wav(), bytes = Buffer.alloc(44 + 8 * 16000); original.copy(bytes, 0, 0, 44);
  bytes.writeUInt32LE(bytes.length - 8, 4); bytes.writeUInt32LE(bytes.length - 44, 40);
  for (let i = 44; i < bytes.length; i += 2) bytes.writeInt16LE(Math.round(amplitude * 32767 * Math.sin(2 * Math.PI * 440 * ((i - 44) / 2) / 8000)), i);
  return bytes;
};
actual.each([.8, .01])('real FFmpeg measures and normalizes a sine at amplitude %s without changing the original', async amplitude => {
  const bytes = sine(amplitude), before = Buffer.from(bytes);
  const result = await normalizeAudio({ ...source, duration: 8 }, bytes);
  expect(result.loudness.outputTruePeakDbtp).toBeLessThanOrEqual(-1); expect(result.loudness.appliedGainDb).toBeLessThanOrEqual(6);
  if (amplitude > .1) expect(Math.abs(result.loudness.outputIntegratedLufs + 14)).toBeLessThan(.5);
  else expect(result.loudness.appliedGainDb).toBe(6);
  expect(result.details.bitrate).toBe(192000); expect(result.details.sampleRate).toBe(44100); expect(bytes).toEqual(before);
}, 30000);
actual('real silent audio is rejected instead of receiving invented loudness', async () => {
  await expect(normalizeAudio(source, wav())).rejects.toThrow('Unmeasurable');
}, 30000);
