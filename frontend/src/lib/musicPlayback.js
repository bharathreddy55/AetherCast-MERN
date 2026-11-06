import { resolveEpisodeMedia } from './resolveEpisodeMedia.js';

export const isMusic = item => item?.kind === 'track';
export const sameMedia = (left, right) => !!left && !!right && isMusic(left) === isMusic(right) && left._id === right._id
  && (!left.queueItemId || !right.queueItemId || left.queueItemId === right.queueItemId);
export const artistNames = track => (track?.artistCredits || []).map(credit => credit.artist?.name).filter(Boolean).join(', ') || 'Unknown artist';
export function initialPlaybackPosition(item, active, audio) {
  return sameMedia(item, active) && !audio.ended && Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : 0;
}
export function adjacentMedia(queue, current, offset) {
  const index = queue.findIndex(item => sameMedia(item, current));
  return index < 0 ? null : queue[index + offset] || null;
}
export function episodeProgressSnapshot(media, auth, audio) {
  if (!media?.ready || isMusic(media.episode) || media.ownerId !== auth?.ownerId) return null;
  return { ...auth, episodeId: media.episode._id, position: audio.currentTime, duration: audio.duration };
}
export async function resolvePlayerMedia(item, { fetchTrack, ...episodeOptions }) {
  if (!isMusic(item)) return resolveEpisodeMedia(item, episodeOptions);
  const response = await fetchTrack(item._id);
  const data = await response.json();
  if (!response.ok || !data.success || data.track?._id !== item._id || !data.track.audioUrl) {
    throw new Error(data.message || 'This song is unavailable.');
  }
  return { episode: { ...data.track, kind: 'track', ...(item.queueItemId ? { queueItemId: item.queueItemId } : {}) }, downloadedResponse: null, expiresIn: data.expiresIn };
}
export function formatMusicTime(value) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
