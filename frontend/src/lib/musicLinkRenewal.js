// Expiry is advisory metadata from the authenticated playback response, not a
// client-decoded token or permission to reuse a previously denied source.
export function musicLinkExpiry(expiresIn, requestedAt) {
  return Number.isSafeInteger(expiresIn) && expiresIn > 0 && expiresIn <= 86400 && Number.isFinite(requestedAt)
    ? requestedAt + expiresIn * 1000 : null;
}
export function musicLinkNeedsRenewal(media, now = Date.now()) {
  return Number.isFinite(media?.expiresAt) && now >= media.expiresAt - 60000;
}

export function createMusicLinkRenewal({ getSnapshot, renew, now = Date.now,
  schedule = setTimeout, unschedule = clearTimeout, onFailure = () => {} }) {
  let timer = null, pending = null, budgetKey = '', attempts = [];
  const identity = state => JSON.stringify([state.media.ownerId, state.media.episode._id, state.media.episode.queueItemId || '', state.media.quality]);
  const read = () => {
    const state = getSnapshot(), media = state?.media;
    return state?.allowed && !state.loading && !!state.audio && media?.ready && media.episode?.kind === 'track'
      && media.source && !media.source.startsWith('blob:') && media.quality === state.quality
      && !state.audio.ended && musicLinkNeedsRenewal(media, now()) ? state : null;
  };
  const cancel = () => { if (timer !== null) unschedule(timer); timer = null; };
  const run = (state, { position = state.audio.error && Number.isFinite(state.media.lastPosition)
    ? Math.max(state.media.lastPosition, Number.isFinite(state.audio.currentTime) ? state.audio.currentTime : 0) : state.audio.currentTime, automatic = true } = {}) => {
    if (pending || !Number.isFinite(position)) return false;
    const media = state.media;
    const key = identity(state), time = now();
    if (key !== budgetKey) { budgetKey = key; attempts = []; }
    if (automatic) {
      attempts = attempts.filter(value => time - value < 600000);
      if (attempts.length >= 2 || (attempts.length && time - attempts.at(-1) < 60000)) return false;
      attempts.push(time);
    }
    cancel();
    const attempt = {}; pending = attempt;
    try {
      Promise.resolve(renew({ item: media.episode, position: Math.max(0, position), keepPaused: !state.playIntent, automatic }))
        .catch(() => {
          const current = getSnapshot();
          if (pending === attempt && current?.allowed && current.media === media && identity(current) === key) onFailure();
        }).finally(() => { if (pending === attempt) pending = null; });
    } catch {
      pending = null;
      const current = getSnapshot();
      if (current?.allowed && current.media === media && identity(current) === key) onFailure();
      return false;
    }
    return true;
  };
  return {
    interrupted() {
      const state = read();
      return !!state && state.playIntent && [2, 4].includes(state.audio.error?.code) && run(state);
    },
    waiting() {
      const state = read();
      if (!state || !state.playIntent || state.audio.paused || timer !== null || pending) return;
      const source = state.media.source, requestId = state.media.requestId, key = identity(state), position = state.audio.currentTime;
      timer = schedule(() => {
        timer = null;
        const current = read();
        if (current && current.playIntent && !current.audio.paused && current.media.source === source
          && current.media.requestId === requestId && identity(current) === key
          && Math.abs(current.audio.currentTime - position) <= .25) {
          if (!run(current)) onFailure();
        }
      }, 8000);
    },
    // A seek is an explicit user action, so it is not an automatic retry loop.
    seek(position) { const state = read(); return !!state && run(state, { position, automatic: false }); },
    playing: cancel,
    cancel,
    reset() { cancel(); pending = null; budgetKey = ''; attempts = []; },
  };
}
