const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { analyzeAudio } = require('./audioAnalysis');
const audioFormats = { mp3: 'mp3', wav: 'wav', flac: 'flac', ogg: 'ogg', m4a: 'mov', aac: 'aac' };
const processingEnabled = () => process.env.MUSIC_PROCESSING_ENABLED === 'true';
function imageSize(bytes, format) {
  let width, height;
  if (format === 'png' && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR') {
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20);
  } else if (['jpg', 'jpeg'].includes(format) && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 255) break;
      const marker = bytes[offset + 1], size = bytes.readUInt16BE(offset + 2);
      if (size < 2 || offset + 2 + size > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && size >= 8) { height = bytes.readUInt16BE(offset + 5); width = bytes.readUInt16BE(offset + 7); break; }
      offset += 2 + size;
    }
  }
  if (!width || !height || width > 8192 || height > 8192 || width * height > 16000000) throw new Error('Unsupported or oversized artwork');
  return { width, height };
}
function conversionArgs(source, profile, input, output) {
  const audio = profile === 'mp3-192-v1';
  if (audio ? source.kind !== 'audio' || !audioFormats[source.format] : profile !== 'cover-320-v1' || source.kind !== 'image' || !['jpg', 'jpeg', 'png'].includes(source.format)) throw new Error('Unsupported processing profile/source');
  return ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-max_alloc', '67108864', '-threads', '1', '-protocol_whitelist', 'file,pipe',
    '-f', audio ? audioFormats[source.format] : source.format === 'png' ? 'png_pipe' : 'jpeg_pipe',
    ...(source.format === 'm4a' ? ['-enable_drefs', '0', '-use_absolute_path', '0'] : []), '-i', input,
    '-map_metadata', '-1', '-map_chapters', '-1',
    ...(audio ? ['-map', '0:a:0', '-vn', '-sn', '-dn', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', '-threads', '1', '-fs', '67108864', '-f', 'mp3']
      : ['-map', '0:v:0', '-an', '-frames:v', '1', '-vf', 'scale=320:320:force_original_aspect_ratio=decrease', '-q:v', '3', '-threads', '1', '-fs', '2097152', '-f', 'image2']), output];
}
function runFfmpeg(args, cwd, { spawnImpl = spawn, timeoutMs = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    const env = { PATH: process.env.PATH || '', ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), TMP: cwd, TEMP: cwd };
    const child = spawnImpl(process.env.FFMPEG_PATH || 'ffmpeg', args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let settled = false, errors = 0, failure;
    const finish = error => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => { failure = new Error('Media conversion timed out'); child.kill('SIGKILL'); }, timeoutMs);
    child.stderr?.on('data', bytes => { errors += bytes.length; if (errors > 65536) { failure = new Error('Media conversion failed'); child.kill('SIGKILL'); } });
    child.once('error', () => finish(new Error('FFmpeg is unavailable')));
    child.once('close', code => finish(failure || (code === 0 ? null : new Error('Media conversion failed'))));
  });
}
async function convertMedia(source, bytes, profile, { run = runFfmpeg, analyze = analyzeAudio } = {}) {
  const audio = profile === 'mp3-192-v1';
  if (!audio) imageSize(bytes, source.format);
  const root = path.resolve(os.tmpdir()), dir = await fs.mkdtemp(path.join(root, 'aether-media-'));
  try {
    const input = path.join(dir, 'source.bin'), output = path.join(dir, audio ? 'output.mp3' : 'output.jpg');
    const args = conversionArgs(source, profile, input, output);
    await fs.writeFile(input, bytes, { flag: 'wx', mode: 0o600 });
    await run(args, dir);
    const size = (await fs.stat(output)).size;
    if (!size || size > (audio ? 67108864 : 2097152)) throw new Error('Invalid processed output size');
    const result = await fs.readFile(output);
    if (audio) {
      const inspected = await analyze(result, 'compatible.mp3', 'audio/mpeg');
      if (Math.abs(inspected.technical.duration - source.duration) > Math.max(.25, source.duration * .002)) throw new Error('Processed duration differs from original');
      return { bytes: result, name: 'compatible.mp3', details: { kind: 'audio', format: 'mp3', mimeType: 'audio/mpeg', status: 'ready', ...inspected.technical } };
    }
    const dimensions = imageSize(result, 'jpg');
    if (dimensions.width > 320 || dimensions.height > 320 || result.at(-2) !== 255 || result.at(-1) !== 217) throw new Error('Invalid thumbnail');
    return { bytes: result, name: 'thumbnail.jpg', details: { kind: 'image', format: 'jpg', codec: 'jpeg', mimeType: 'image/jpeg', status: 'ready', ...dimensions } };
  } finally {
    if (path.dirname(dir) !== root || !path.basename(dir).startsWith('aether-media-')) throw new Error('Invalid processing temporary directory');
    await fs.rm(dir, { recursive: true, force: true });
  }
}
module.exports = { processingEnabled, imageSize, conversionArgs, runFfmpeg, convertMedia };
