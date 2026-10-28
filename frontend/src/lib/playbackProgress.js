export function progressSnapshot(value, completed = false) {
  if (!value?.episodeId || !value.ownerId || !value.token ||
      !Number.isFinite(value.position) || !Number.isFinite(value.duration) || value.duration <= 0) return null;
  const position = completed ? value.duration : Math.max(0, Math.min(value.position, value.duration));
  return { ...value, position, completed: completed || position / value.duration >= 0.95 };
}

// The timer belongs to actual media playback, not React renders/time updates.
// Snapshot at enqueue time; serialize writes so a slow older save cannot win.
export function createProgressTracker({ getSnapshot, send, onError = () => {},
  setIntervalFn = setInterval, clearIntervalFn = clearInterval, intervalMs = 10000 }) {
  let timer = null;
  let pending = Promise.resolve();
  const checkpoints = new Map();
  const key = (ownerId, episodeId) => `${ownerId}:${episodeId}`;
  const save = (options = {}) => {
    const snapshot = progressSnapshot(getSnapshot(), options.completed);
    if (!snapshot) return Promise.resolve(false);
    checkpoints.set(key(snapshot.ownerId, snapshot.episodeId), snapshot);
    const task = pending.then(() => send(snapshot, options)).then(() => true).catch(error => {
      onError(error);
      return false;
    });
    pending = task;
    return task;
  };
  return {
    save,
    start() {
      if (timer === null) timer = setIntervalFn(() => { void save(); }, intervalMs);
    },
    stop({ save: shouldSave = true, ...options } = {}) {
      if (timer !== null) clearIntervalFn(timer);
      timer = null;
      return shouldSave ? save(options) : Promise.resolve(false);
    },
    latest(ownerId, episodeId) { return checkpoints.get(key(ownerId, episodeId)); },
    clear() { checkpoints.clear(); },
    flush() { return pending; },
  };
}

export function createProgressSender(apiBaseUrl, fetchImpl = globalThis.fetch) {
  return async (snapshot, { keepalive = false } = {}) => {
    const response = await fetchImpl(`${apiBaseUrl}/episodes/${encodeURIComponent(snapshot.episodeId)}/progress`, {
      method: 'POST', cache: 'no-store', redirect: 'error', keepalive,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${snapshot.token}` },
      body: JSON.stringify({ position: snapshot.position, duration: snapshot.duration }),
      ...(keepalive ? {} : { signal: AbortSignal.timeout(10000) }),
    });
    if (!response.ok) throw new Error('Playback progress could not be saved.');
  };
}
