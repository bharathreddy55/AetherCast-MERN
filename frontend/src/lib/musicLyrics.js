export function activeLyricTime(lines, position, offsetMs) {
  const time = position - offsetMs / 1000;
  let low = 0, high = lines.length - 1, result = null;
  while (low <= high) { const middle = Math.floor((low + high) / 2); if (lines[middle].at <= time) { result = lines[middle].at; low = middle + 1; } else high = middle - 1; }
  return result;
}
export function lyricSeekPosition(at, offsetMs, duration) { return Math.max(0, Math.min(duration || 0, at + offsetMs / 1000)); }
export async function readLyricFile(file) {
  if (!/\.(txt|lrc)$/i.test(file.name) || file.size > 100000) throw new Error('Choose a UTF-8 .txt or .lrc file up to 100 KB.');
  const content = await file.text();
  if (content.length > 50000 || content.includes('\uFFFD')) throw new Error('Use UTF-8 lyrics with at most 50000 characters.');
  return { content, format: /\.lrc$/i.test(file.name) ? 'lrc' : 'plain' };
}
