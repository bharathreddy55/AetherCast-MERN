const { exactBody, failure, version } = require('./musicLibrary');
function parseLrc(content) {
  const result = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || /^\[(ar|ti|al|by|re|ve|length):[^\]]*\]$/i.test(line)) continue;
    const tags = line.match(/^(?:\[\d{1,4}:\d{2}(?:\.\d{1,3})?\])+/)?.[0];
    if (!tags) throw failure(400, 'Every LRC lyric line needs a [mm:ss.xx] timestamp. Use the offset field for timing adjustments.');
    const text = line.slice(tags.length).trim();
    for (const tag of tags.matchAll(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g)) {
      const seconds = Number(tag[2]), at = Number(tag[1]) * 60 + seconds + Number(`0.${tag[3] || '0'}`);
      if (seconds >= 60 || at > 86400 || text.length > 2000) throw failure(400, 'Invalid LRC time or line length');
      result.push({ at, text });
      if (result.length > 4000) throw failure(400, 'Lyrics support up to 4000 timed lines');
    }
  }
  if (content.trim() && !result.length) throw failure(400, 'LRC lyrics need at least one timed line');
  return result.sort((a, b) => a.at - b.at);
}
function lyricsInput(body) {
  exactBody(body, ['version', 'content', 'format', 'offsetMs', 'source']); version(body.version);
  if (typeof body.content !== 'string' || body.content.length > 50000 || Buffer.byteLength(body.content) > 100000
    || !['plain', 'lrc'].includes(body.format) || !Number.isSafeInteger(body.offsetMs) || Math.abs(body.offsetMs) > 60000
    || typeof body.source !== 'string' || body.source.length > 300) throw failure(400, 'Invalid lyrics content, format, source or offset');
  const content = body.content.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  if (content.split('\n').length > 2000) throw failure(400, 'Lyrics support up to 2000 source lines');
  if (body.format === 'lrc') parseLrc(content);
  return { content, format: body.format, offsetMs: body.offsetMs, source: body.source.trim() };
}
function lyricsDto(record) {
  const data = record || { version: 0, content: '', format: 'plain', offsetMs: 0, source: '' };
  return { version: data.version, content: data.content, format: data.format, offsetMs: data.offsetMs, source: data.source,
    lines: data.format === 'lrc' ? parseLrc(data.content) : [] };
}
module.exports = { parseLrc, lyricsInput, lyricsDto };
