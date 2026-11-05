import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { musicLibraryRequest, notifyMusicLibrary } from '../lib/musicLibraryApi';
import './MusicCollections.css';

export default function PlaylistPicker({ track, onClose }) {
  const dialog = useRef(null), mutation = useRef(null);
  const [page, setPage] = useState(1), [data, setData] = useState(null), [selected, setSelected] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const abortMutation = useCallback(() => mutation.current?.abort(), []);
  useEffect(() => {
    const element = dialog.current; element.showModal();
    return () => { abortMutation(); element.close(); };
  }, [abortMutation]);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    musicLibraryRequest(`/playlists?page=${page}&limit=25`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setData(result); setSelected(result.items[0]?._id || ''); }
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [page, retry]);
  const add = async event => {
    event.preventDefault(); if (!selected || busy) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError('');
    try {
      const current = await musicLibraryRequest(`/playlists/${selected}`, { signal: controller.signal });
      await musicLibraryRequest(`/playlists/${selected}`, { method: 'PATCH', signal: controller.signal,
        body: { version: current.playlist.version, operation: 'add', trackIds: [track._id] } });
      if (!controller.signal.aborted) { notifyMusicLibrary(); onClose(); }
    } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <dialog className="playlist-picker" ref={dialog} onCancel={onClose} aria-labelledby="playlist-picker-title">
    <h2 id="playlist-picker-title">Add to playlist</h2><p>{track.title}</p>
    {error && <p role="alert">{error} <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)}>Reload playlists</button></p>}
    {!data ? <p role="status">Loading playlists…</p> : data.items.length ? <form onSubmit={add}>
      <label>Playlist<select value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>{data.items.map(item => <option value={item._id} key={item._id}>{item.name}</option>)}</select></label>
      <div className="music-collection-actions"><button className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add song'}</button><button type="button" className="btn-secondary" disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button type="button" className="btn-secondary" disabled={busy || page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>
    </form> : <p>No playlists yet. <Link to="/music/collections?view=playlists" onClick={onClose}>Create a music playlist</Link>.</p>}
    <button className="btn-secondary" disabled={busy} onClick={onClose}>Close</button>
  </dialog>;
}
