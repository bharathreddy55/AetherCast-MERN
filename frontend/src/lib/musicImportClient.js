export const DEFAULT_IMPORT_FORMATS = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'];
export function selectMusicFiles(files, { formats = DEFAULT_IMPORT_FORMATS, maxBytes, maxPending = 20 }) {
  const supported = [...files].filter(file => formats.includes(file.name.split('.').at(-1)?.toLowerCase()));
  if (!supported.length) throw new Error('Choose supported audio files.');
  if (supported.length > maxPending) throw new Error(`Choose up to ${maxPending} audio files at a time.`);
  return { skipped: files.length - supported.length, files: supported.map(file => ({ file,
    error: file.size > maxBytes ? `File exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit.` : file.size === 0 ? 'This file is empty.' : '' })) };
}
export async function uploadMusicFiles(entries, { upload, onUpdate, signal }) {
  for (const entry of entries) {
    if (signal.aborted) break;
    onUpdate(entry.key, { status: 'uploading', error: '' });
    try {
      const result = await upload(entry.file, signal);
      if (!signal.aborted) onUpdate(entry.key, { status: 'uploaded', jobId: result.import._id, error: '',
        label: result.duplicate ? result.import.status === 'completed' ? 'Already in your library' : 'Existing import found' : 'Uploaded for processing' });
    } catch (error) {
      onUpdate(entry.key, { status: signal.aborted ? 'cancelled' : 'failed', error: signal.aborted ? 'Upload stopped. Check recent imports before retrying.' : error.message });
    }
  }
}
const splitNames = value => [...new Set(value.split(';').map(name => name.trim()).filter(Boolean))];
export function reviewPayload(form) {
  return { title: form.title.trim(), artistNames: splitNames(form.artists), albumTitle: form.album.trim(),
    albumArtistNames: splitNames(form.albumArtists), genres: [...new Set(form.genres.split(',').map(genre => genre.trim()).filter(Boolean))],
    releaseDate: form.releaseDate || null, language: form.language.trim(), explicit: form.explicit,
    isCompilation: form.isCompilation, discNumber: Number(form.discNumber), trackNumber: Number(form.trackNumber) };
}
