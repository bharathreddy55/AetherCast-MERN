import { isMusic, sameMedia, initialPlaybackPosition } from './musicPlayback.js';
export function playbackPausedIntent({ audio, loading, playIntent }) {
  return loading ? !playIntent : audio.paused;
}
export function recoveryPosition({ item, active, audio, retry, ownerId, restart = false, lastPosition }) {
  if (restart) return 0;
  if (sameMedia(item, active)) {
    const position = initialPlaybackPosition(item, active, audio);
    return !audio.ended && audio.error && Number.isFinite(lastPosition) ? Math.max(position, lastPosition, 0) : position;
  }
  if (isMusic(item) && retry?.ownerId === ownerId && sameMedia(item, retry.item)
    && item.queueItemId === retry.item.queueItemId && Number.isFinite(retry.position)) return Math.max(0, retry.position);
  return 0;
}

export function createAudioPlayback({ getAudio, canPlay, getRevision, onError }) {
  let pending = null;
  const fail = requestId => { if (requestId === getRevision() && canPlay()) onError('Unable to start playback. Press play to retry.'); };
  return {
    play(requestId) {
      if (!canPlay() || pending || !getAudio().paused) return;
      const attempt = { requestId }; pending = attempt;
      try {
        Promise.resolve(getAudio().play()).catch(() => fail(requestId))
          .finally(() => { if (pending === attempt) pending = null; });
      } catch { if (pending === attempt) pending = null; fail(requestId); }
    },
    pending: () => !!pending,
    cancel() { pending = null; },
  };
}
