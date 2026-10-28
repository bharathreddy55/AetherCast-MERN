const path = require('path');
const crypto = require('crypto');
const fail = message => Object.assign(new Error(message), { status: 400 });
const formats = { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac' };
function importLimits() {
  const mb = Number(process.env.MUSIC_MAX_UPLOAD_MB || 50);
  if (!Number.isSafeInteger(mb) || mb < 1 || mb > 200) throw new Error('MUSIC_MAX_UPLOAD_MB must be an integer between 1 and 200');
  return { maxBytes: mb * 1024 * 1024, formats: Object.keys(formats), maxPending: 20 };
}
function inspectAudio(bytes, filename) {
  const format = path.extname(filename).slice(1).toLowerCase();
  if (!formats[format] || bytes.length < 12) throw fail('Choose a supported MP3, WAV, FLAC, OGG, M4A or AAC audio file.');
  const valid = {
    mp3: bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224 && (bytes[1] & 6) !== 0),
    wav: bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE',
    flac: bytes.toString('ascii', 0, 4) === 'fLaC', ogg: bytes.toString('ascii', 0, 4) === 'OggS',
    m4a: bytes.toString('ascii', 4, 8) === 'ftyp', aac: bytes[0] === 255 && (bytes[1] & 246) === 240,
  }[format];
  if (!valid) throw fail('The file contents do not match its audio extension.');
  return { format, mimeType: formats[format], checksum: crypto.createHash('sha256').update(bytes).digest('hex') };
}
const text = (value, max) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max) : '';
const names = (values, fallback = []) => {
  const cleaned = [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 200)).filter(Boolean))].slice(0, 20);
  return cleaned.length ? cleaned : fallback;
};
const integer = value => Number.isSafeInteger(value) && value > 0 ? value : 1;
function extractReview(common, filename) {
  const rawDate = text(common.date, 40);
  const year = Number.isInteger(common.year) && common.year > 999 && common.year < 10000 ? common.year : null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : year ? `${year}-01-01` : null;
  const releaseDate = date && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : null;
  const artistNames = names(common.artists || (common.artist ? [common.artist] : []), ['Unknown Artist']);
  return {
    title: text(common.title, 300) || text(path.basename(filename, path.extname(filename)), 300) || 'Untitled track',
    artistNames, albumTitle: text(common.album, 300), isCompilation: common.compilation === true,
    albumArtistNames: names(common.albumartists || (common.albumartist ? [common.albumartist] : []), common.compilation ? [] : artistNames),
    discNumber: integer(common.disk?.no), trackNumber: integer(common.track?.no), releaseDate,
    genres: names(common.genre).map(value => value.slice(0, 64)), language: text(common.language, 64), explicit: false,
  };
}
function reviewInput(body) {
  const allowed = ['title', 'artistNames', 'albumTitle', 'albumArtistNames', 'isCompilation', 'discNumber', 'trackNumber', 'releaseDate', 'genres', 'language', 'explicit'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw fail('Invalid import metadata.');
  for (const [key, max] of [['title', 300], ['albumTitle', 300], ['language', 64]]) {
    if (typeof body[key] !== 'string' || body[key].length > max || (key === 'title' && !body[key].trim())) throw fail(`Invalid ${key}.`);
  }
  for (const key of ['artistNames', 'albumArtistNames', 'genres']) {
    if (!Array.isArray(body[key]) || body[key].length > 20 || body[key].some(value => typeof value !== 'string' || !value.trim() || value.length > (key === 'genres' ? 64 : 200))) throw fail(`Invalid ${key}.`);
  }
  if (!body.artistNames.length || (!body.isCompilation && body.albumTitle.trim() && !body.albumArtistNames.length)) throw fail('Choose artists for this track and album.');
  if (typeof body.explicit !== 'boolean' || typeof body.isCompilation !== 'boolean' || ![body.discNumber, body.trackNumber].every(value => Number.isSafeInteger(value) && value > 0)) throw fail('Invalid track settings.');
  if (body.releaseDate !== null && (typeof body.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.releaseDate) || !Number.isFinite(Date.parse(body.releaseDate)) || new Date(body.releaseDate).toISOString().slice(0, 10) !== body.releaseDate)) throw fail('Choose a valid release date.');
  return { ...body, title: text(body.title, 300), albumTitle: text(body.albumTitle, 300), language: text(body.language, 64),
    artistNames: names(body.artistNames), albumArtistNames: names(body.albumArtistNames), genres: names(body.genres) };
}
module.exports = { importLimits, inspectAudio, extractReview, reviewInput };
