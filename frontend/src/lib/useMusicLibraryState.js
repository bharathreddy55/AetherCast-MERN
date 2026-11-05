import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { musicLibraryRequest, notifyMusicLibrary } from './musicLibraryApi';
import { libraryPaths, libraryStateFields } from './musicLibraryClient';

export function useMusicLibraryState(records, resource = 'tracks') {
  const { user } = useAuth();
  const ids = [...new Set(records.map(record => record._id).filter(Boolean))].sort().join(',');
  const key = `${user?.id || ''}:${resource}:${ids}`;
  const [state, setState] = useState({ key: '', ids: [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState([]);
  const [revision, setRevision] = useState(0);
  const live = useRef(key); live.current = key;
  const pending = useRef(new Map());
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('music-library-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('music-library-changed', refresh); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const field = libraryStateFields[resource];
    if (user?.id && ids) musicLibraryRequest(`/state?${field}=${ids}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setState({ key, ids: data[field] }); setError(''); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [ids, resource, key, revision, user?.id]);
  useEffect(() => {
    const requests = pending.current;
    setBusy([]);
    return () => { requests.forEach(controller => controller.abort()); requests.clear(); };
  }, [key]);
  const saved = state.key === key ? state.ids : [];
  const ready = state.key === key;
  const toggle = async id => {
    if (!ready || pending.current.has(id)) return;
    const controller = new AbortController(); pending.current.set(id, controller);
    setBusy([...pending.current.keys()]); setError('');
    try {
      const data = await musicLibraryRequest(`${libraryPaths[resource]}/${id}`, { method: saved.includes(id) ? 'DELETE' : 'PUT', signal: controller.signal });
      if (!controller.signal.aborted && live.current === key) {
        setState(previous => ({ key, ids: data.saved ? [...new Set([...previous.ids, id])] : previous.ids.filter(value => value !== id) }));
        notifyMusicLibrary();
      }
    } catch (failure) { if (!controller.signal.aborted && live.current === key) setError(failure.message); }
    finally {
      if (pending.current.get(id) === controller) pending.current.delete(id);
      if (live.current === key) setBusy([...pending.current.keys()]);
    }
  };
  return { saved, ready, busy, error, toggle, reload: () => setRevision(value => value + 1) };
}
