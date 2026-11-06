const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { conversionArgs, runFfmpeg } = require('./mediaConversion');
const { analyzeAudio } = require('./audioAnalysis');
const { loudnessDto } = require('../utils/musicLoudness');
function parseLoudness(log) {
  if (typeof log !== 'string' || Buffer.byteLength(log) > 65536) throw new Error('Invalid loudness output');
  const blocks = log.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (blocks?.length !== 1) throw new Error('Missing or ambiguous loudness output');
  const value = JSON.parse(blocks[0]);
  const number = (key, min, max) => {
    if (typeof value[key] !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value[key])) throw new Error('Unmeasurable audio loudness');
    const result = Number(value[key]);
    if (!Number.isFinite(result) || result < min || result > max) throw new Error('Unsupported loudness measurement');
    return result;
  };
  return { integratedLufs: number('input_i', -70, 5), truePeakDbtp: number('input_tp', -99, 20) };
}
function normalizationGain(measurement) {
  if (!Number.isFinite(measurement?.integratedLufs) || !Number.isFinite(measurement?.truePeakDbtp)) throw new Error('Missing loudness measurement');
  // Fixed gain only: target -14 LUFS, reserve 2 dB pre-encode peak headroom,
  // and cap boosts at 6 dB. Quiet/high-crest-factor songs may remain quieter.
  const gain = Math.min(6, -14 - measurement.integratedLufs, -2 - measurement.truePeakDbtp);
  if (gain < -60) throw new Error('Unsupported normalization gain');
  return Number(gain.toFixed(4));
}
function measurementArgs(source, input) {
  const args = conversionArgs(source, 'mp3-192-v1', input, 'unused');
  return [...args.slice(0, args.indexOf('-map_metadata')), '-nostats', '-loglevel', 'info', '-filter_threads', '1', '-map', '0:a:0', '-vn', '-sn', '-dn',
    '-af', 'aformat=channel_layouts=stereo,aresample=44100,loudnorm=I=-14:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'];
}
async function normalizeAudio(source, bytes, { run = runFfmpeg, analyze = analyzeAudio } = {}) {
  if (source.kind !== 'audio' || !Number.isFinite(source.duration) || source.duration <= 0) throw new Error('Audio source required');
  const root = path.resolve(os.tmpdir()), dir = await fs.mkdtemp(path.join(root, 'aether-normalized-'));
  try {
    const input = path.join(dir, 'source.bin'), output = path.join(dir, 'normalized.mp3');
    await fs.writeFile(input, bytes, { flag: 'wx', mode: 0o600 });
    const before = parseLoudness(await run(measurementArgs(source, input), dir, { captureStderr: true, timeoutMs: 120000 }));
    const gain = normalizationGain(before), args = conversionArgs(source, 'mp3-192-v1', input, output);
    args.splice(args.indexOf('-i'), 0, '-filter_threads', '1');
    args.splice(args.indexOf('-c:a'), 0, '-af', `aformat=channel_layouts=stereo,aresample=44100,volume=${gain}dB`);
    await run(args, dir, { timeoutMs: 120000 });
    const size = (await fs.stat(output)).size;
    if (!size || size > 67108864) throw new Error('Invalid normalized output size');
    const result = await fs.readFile(output), inspected = await analyze(result, 'normalized.mp3', 'audio/mpeg');
    if (!Number.isFinite(inspected.technical.duration) || Math.abs(inspected.technical.duration - source.duration) > Math.max(.25, source.duration * .002)) throw new Error('Normalized duration differs from original');
    const after = parseLoudness(await run(measurementArgs({ kind: 'audio', format: 'mp3' }, output), dir, { captureStderr: true, timeoutMs: 120000 }));
    const loudness = loudnessDto({ mode: 'linear', targetIntegratedLufs: -14, maxTruePeakDbtp: -1, appliedGainDb: gain,
      inputIntegratedLufs: before.integratedLufs, inputTruePeakDbtp: before.truePeakDbtp,
      outputIntegratedLufs: after.integratedLufs, outputTruePeakDbtp: after.truePeakDbtp });
    if (!loudness) throw new Error('Encoded normalized audio exceeds the measured peak limit');
    return { bytes: result, name: 'normalized.mp3', loudness, details: { kind: 'audio', format: 'mp3', mimeType: 'audio/mpeg', status: 'ready', ...inspected.technical } };
  } finally {
    if (path.dirname(dir) !== root || !path.basename(dir).startsWith('aether-normalized-')) throw new Error('Invalid normalization temporary directory');
    await fs.rm(dir, { recursive: true, force: true });
  }
}
module.exports = { normalizeAudio, parseLoudness, normalizationGain, measurementArgs };
