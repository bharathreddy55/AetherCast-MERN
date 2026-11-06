import { artistNames, isMusic } from './musicPlayback.js';

const actions = ['play', 'pause', 'stop', 'nexttrack', 'previoustrack', 'seekto', 'seekforward', 'seekbackward'];
export function musicPositionState(audio) {
  if (!Number.isFinite(audio?.duration) || audio.duration <= 0 || !Number.isFinite(audio.currentTime) || !Number.isFinite(audio.playbackRate) || audio.playbackRate <= 0) return null;
  return { duration: audio.duration, position: Math.min(audio.duration, Math.max(0, audio.currentTime)), playbackRate: audio.playbackRate };
}
// Browser APIs are optional. Never include audio URLs, signed artwork or account data in OS metadata.
export function createMusicMediaSession({ session, Metadata, getSnapshot, getCommands }) {
  let disposed = false, signature = '', bound = new Map();
  const attempt = fn => { try { fn(); } catch { /* Browser/action support varies. */ } };
  const valid = () => {
    const state = getSnapshot();
    return !disposed && state?.allowed && isMusic(state.track) ? state : null;
  };
  const position = state => attempt(() => {
    const value = state?.ready ? musicPositionState(state.audio) : null;
    if (value) session?.setPositionState?.(value); else session?.setPositionState?.();
  });
  const invoke = (action, details = {}) => {
    if (disposed) return;
    const state = valid();
    if (!state && !(getSnapshot()?.canCancel && ['pause', 'stop'].includes(action))) return;
    const commands = getCommands();
    const run = name => { try { Promise.resolve(commands[name]?.()).catch(() => {}); } catch { /* Player reports playback errors. */ } };
    if (action === 'play') run('play');
    else if (action === 'pause') run('pause');
    else if (action === 'stop') run('stop');
    else if (action === 'nexttrack' && state.hasNext) run('next');
    else if (action === 'previoustrack' && state.hasPrevious) run('previous');
    else if (state.ready) {
      const value = musicPositionState(state.audio); if (!value) return;
      let target;
      if (action === 'seekto') { if (!Number.isFinite(details.seekTime)) return; target = details.seekTime; }
      else if (['seekforward', 'seekbackward'].includes(action)) {
        const offset = details.seekOffset === undefined ? 10 : details.seekOffset;
        if (!Number.isFinite(offset) || offset <= 0) return;
        target = value.position + (action === 'seekforward' ? offset : -offset);
      }
      if (target !== undefined) attempt(() => commands.seek?.(Math.max(0, Math.min(value.duration, target))));
    }
    position(valid());
  };
  const bind = (action, enabled) => {
    if (bound.get(action) === enabled) return;
    attempt(() => session?.setActionHandler?.(action, enabled ? details => invoke(action, details) : null));
    bound.set(action, enabled);
  };
  const clear = () => {
    for (const action of actions) bind(action, false);
    attempt(() => { if (session) session.metadata = null; });
    attempt(() => { if (session) session.playbackState = 'none'; });
    position(null); signature = '';
  };
  return {
    update() {
      if (disposed || !session) return;
      const state = valid();
      if (!state) {
        clear();
        if (getSnapshot()?.canCancel) { bind('pause', true); bind('stop', true); }
        return;
      }
      const metadata = { title: state.track.title || 'Song', artist: artistNames(state.track), album: state.track.album?.title || '', artwork: [] };
      const next = JSON.stringify([state.track._id, state.track.queueItemId, metadata]);
      if (signature !== next) {
        attempt(() => { session.metadata = null; if (Metadata) session.metadata = new Metadata(metadata); }); signature = next;
      }
      attempt(() => { session.playbackState = state.buffering || state.audio.paused || state.audio.ended || state.audio.error ? 'paused' : 'playing'; });
      for (const action of actions) bind(action, action === 'nexttrack' ? !!state.hasNext : action === 'previoustrack' ? !!state.hasPrevious : action.startsWith('seek') ? !!state.ready : true);
      position(state);
    },
    clear,
    dispose() { clear(); disposed = true; bound.clear(); },
  };
}
