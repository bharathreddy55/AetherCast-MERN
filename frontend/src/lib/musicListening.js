export function createMusicListeningTracker({ send, getAuth, now = () => performance.now(), makeId = () => crypto.randomUUID(), onError = () => {} }) {
  let current = null, pending = Promise.resolve();
  const pause = () => {
    if (current?.since !== null && current?.since !== undefined) {
      current.seconds += Math.max(0, now() - current.since) / 1000;
      current.since = null;
    }
  };
  const emit = (type, position, keepalive = false) => {
    const auth = getAuth();
    const token = auth?.ownerId === current.ownerId ? auth.token : current.token;
    if (!token) return;
    const event = { playbackId: current.playbackId, token, trackId: current.track._id, type,
      position: Math.max(0, Math.min(Number.isFinite(position) ? position : 0, current.track.duration)),
      playedSeconds: Math.max(0, Math.min(current.seconds, current.track.duration, 86400)) };
    pending = pending.then(() => send(event, { keepalive })).catch(() => onError());
  };
  const finish = (type, position, options = {}) => {
    pause();
    if (!current || current.finished) return;
    if (current.started) emit(type, position, options.keepalive);
    current.finished = true;
  };
  return {
    attach({ track, ownerId, queueItemId }) {
      if (current && !current.finished && current.ownerId === ownerId && current.queueItemId === queueItemId && current.track._id === track._id) {
        current.track = track; return;
      }
      const auth = getAuth();
      current = { track, ownerId, queueItemId, token: auth?.ownerId === ownerId ? auth.token : null,
        playbackId: makeId(), seconds: 0, since: null, started: false, finished: false };
    },
    playing(position = 0) {
      if (!current) return;
      if (current.finished) current = { ...current, playbackId: makeId(), seconds: 0, since: null, started: false, finished: false };
      if (!current.started) { current.started = true; emit('started', position); }
      if (current.since === null) current.since = now();
    },
    pause, finish,
    reset(position = 0, options = {}) { finish('skipped', position, options); current = null; },
    flush: () => pending,
  };
}

export function createMusicListeningSender(apiBaseUrl, fetchImpl = globalThis.fetch) {
  return async (event, { keepalive = false } = {}) => {
    const { playbackId, token, ...body } = event;
    const response = await fetchImpl(`${apiBaseUrl}/music/library/events/${encodeURIComponent(playbackId)}`, {
      method: 'PUT', cache: 'no-store', redirect: 'error', keepalive,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
      ...(keepalive ? {} : { signal: AbortSignal.timeout(10000) }),
    });
    if (!response.ok) throw new Error('Listening history could not be saved.');
  };
}
