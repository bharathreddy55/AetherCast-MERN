import { musicLinkExpiry } from './musicLinkRenewal.js';
const preferenceKey = 'music.prepareNext';
const fields = ['ownerId', 'token', 'quality', 'from', 'to', 'requestId', 'trackId'];
const sameKey = (left, right) => !!left && !!right && fields.every(field => left[field] === right[field]);
const validKey = key => key && ['ownerId', 'token', 'from', 'to', 'trackId'].every(field => typeof key[field] === 'string' && key[field])
  && ['original', 'compatible', 'normalized'].includes(key.quality) && Number.isSafeInteger(key.requestId);
const aborted = () => new DOMException('Playback preparation cancelled', 'AbortError');
function abortable(work, signal, onAbort = () => {}) {
  if (signal.aborted) { onAbort(); return Promise.reject(aborted()); }
  return new Promise((resolve, reject) => {
    const cancel = () => { onAbort(); reject(aborted()); };
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve(work).then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}
export function readNextPreparation(storage) {
  try { return storage?.getItem(preferenceKey) !== 'off'; } catch { return true; }
}
export function saveNextPreparation(storage, enabled) {
  try { storage?.setItem(preferenceKey, enabled ? 'on' : 'off'); } catch { /* Preference storage is optional. */ }
}
export function atMusicBoundary(audio) {
  return !!audio && (audio.ended || (Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration));
}
export function shouldPrepareNext({ enabled, allowed, loading, buffering, media, audio, next }) {
  const remaining = audio?.duration - audio?.currentTime;
  return !!(enabled && allowed && !loading && !buffering && media?.ready && media.episode?.kind === 'track'
    && next?.track?.kind === 'track' && !audio.paused && !audio.ended && !audio.error
    && Number.isFinite(audio.duration) && audio.duration >= 30 && Number.isFinite(remaining) && remaining > 0 && remaining <= 15);
}

// One authenticated playback response, in memory only. This does not fetch audio
// bytes, overlap songs, change queue order, or authorize a new page/session.
export function createNextMusicPreparation({ load, now = Date.now, schedule = setTimeout, unschedule = clearTimeout }) {
  let cached = null, attempted = null;
  const cancel = () => { cached?.controller.abort(); cached = null; };
  return {
    prepare(key, item) {
      if (!validKey(key) || item?.kind !== 'track' || item._id !== key.trackId || item.queueItemId !== key.to) { cancel(); return false; }
      if (sameKey(attempted, key)) return false;
      cancel(); attempted = { ...key };
      const entry = { key: { ...key }, controller: new AbortController(), requestedAt: now() };
      cached = entry;
      const timeout = schedule(() => entry.controller.abort(), 15000);
      const work = Promise.resolve().then(() => {
        if (entry.controller.signal.aborted) throw aborted();
        return load(item, { signal: entry.controller.signal, quality: key.quality });
      });
      entry.promise = abortable(work, entry.controller.signal).catch(() => undefined).finally(() => unschedule(timeout));
      return true;
    },
    async take(key, signal) {
      const entry = cached; cached = null;
      if (!entry || !validKey(key) || !sameKey(entry.key, key) || now() - entry.requestedAt >= 30000 || now() < entry.requestedAt) {
        entry?.controller.abort(); return undefined;
      }
      const resolved = await abortable(entry.promise, signal, () => entry.controller.abort());
      const expiresAt = musicLinkExpiry(resolved?.expiresIn, entry.requestedAt);
      if (signal.aborted) throw aborted();
      if (entry.controller.signal.aborted || now() - entry.requestedAt >= 30000 || now() < entry.requestedAt
        || !Number.isFinite(expiresAt) || expiresAt - now() < 60000 || resolved?.downloadedResponse !== null
        || resolved?.episode?.kind !== 'track' || resolved.episode._id !== key.trackId || resolved.episode.queueItemId !== key.to
        || resolved.episode.playback?.variant !== key.quality
        || typeof resolved.episode.audioUrl !== 'string' || !resolved.episode.audioUrl) return undefined;
      return { resolved, requestedAt: entry.requestedAt };
    },
    cancel,
    reset() { cancel(); attempted = null; },
  };
}
