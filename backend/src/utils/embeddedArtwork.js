const { imageSize } = require('../services/mediaConversion');
const MAX_COVER_BYTES = 5 * 1024 * 1024;

function inspectArtwork(data) {
  const bytes = Buffer.from(data || []);
  if (!bytes.length || bytes.length > MAX_COVER_BYTES) throw new Error('Unsupported artwork size');
  const format = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png' : 'jpg';
  const dimensions = imageSize(bytes, format);
  return { bytes, details: { kind: 'image', format, mimeType: format === 'png' ? 'image/png' : 'image/jpeg', status: 'ready', ...dimensions } };
}

// Prefer the actual front, never an artist photo, booklet, back or disc label.
// A single untyped picture is usable; multiple untyped pictures are ambiguous.
function selectEmbeddedCover(pictures = []) {
  const front = pictures.filter(picture => ['front', 'cover', 'cover (front)'].includes(String(picture.type || '').trim().toLowerCase()));
  const candidates = front.length ? front : pictures.length === 1 && !pictures[0].type ? pictures : [];
  if (candidates.length !== 1) return null;
  try {
    const { bytes, details } = inspectArtwork(candidates[0].data);
    return { data: bytes, mimeType: details.mimeType };
  } catch { return null; }
}
module.exports = { inspectArtwork, selectEmbeddedCover, MAX_COVER_BYTES };
