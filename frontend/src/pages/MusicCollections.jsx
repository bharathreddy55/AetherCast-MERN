import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Play, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { musicLibraryRequest, notifyMusicLibrary } from '../lib/musicLibraryApi';
import { playablePlaylist } from '../lib/musicLibraryClient';
import { artistNames, formatMusicTime } from '../lib/musicPlayback';
import MusicArtwork from '../components/MusicArtwork';
import '../components/MusicCollections.css';

const views = { playlists: 'Playlists', likes: 'Liked songs', history: 'Recently played', albums: 'Saved albums', artists: 'Followed artists' };
const paths = { playlists: '/playlists', likes: '/likes', history: '/history', albums: '/saved/albums', artists: '/followed/artists' };
export default function MusicCollections() {
  const [params, setParams] = useSearchParams();
  const playlistId = params.get('playlistId');
  const view = Object.hasOwn(views, params.get('view')) ? params.get('view') : 'playlists';
  const page = /^\d+$/.test(params.get('page') || '') ? Math.min(10000, Math.max(1, Number(params.get('page')))) : 1;
  const identity = playlistId ? `/playlists/${encodeURIComponent(playlistId)}` : `${paths[view]}?page=${page}&limit=25`;
  const [result, setResult] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(false);
  const [name, setName] = useState(''), [description, setDescription] = useState('');
  const { playTrack, addToMusicQueue } = usePlayer();
  const mutation = useRef(null), currentIdentity = useRef(identity); currentIdentity.current = identity;
  const abortMutation = useCallback(() => mutation.current?.abort(), []);
  useEffect(() => { setBusy(false); return () => abortMutation(); }, [identity, abortMutation]);
  const data = result?.identity === identity ? result : null;
  const coverTracks = (data?.items || []).filter(item => item.track).slice(0, 4).map(item => item.track);
  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    const changed = () => setRevision(value => value + 1);
    window.addEventListener('music-library-changed', changed);
    if (view === 'history') window.addEventListener('music-history-changed', changed);
    return () => { window.removeEventListener('music-library-changed', changed); window.removeEventListener('music-history-changed', changed); };
  }, [view]);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setResult(null);
    musicLibraryRequest(identity, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setResult({ ...value, identity }); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [identity, revision]);
  useEffect(() => { setName(data?.playlist?.name || ''); setDescription(data?.playlist?.description || ''); }, [data?.playlist?._id, data?.playlist?.version, data?.playlist?.name, data?.playlist?.description]);
  const mutate = async operation => {
    if (busy) return;
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setError(''); setNotice('');
    try { await operation(controller.signal); if (!controller.signal.aborted) notifyMusicLibrary(); }
    catch (failure) { if (!controller.signal.aborted && currentIdentity.current === identity) setError(failure.message); }
    finally { if (!controller.signal.aborted && currentIdentity.current === identity) setBusy(false); }
  };
  const create = event => {
    event.preventDefault();
    void mutate(async signal => {
      const response = await musicLibraryRequest('/playlists', { method: 'POST', signal, body: { name, description } });
      if (!signal.aborted) setParams({ view: 'playlists', playlistId: response.playlist._id });
    });
  };
  const edit = changes => mutate(signal => musicLibraryRequest(`/playlists/${playlistId}`, { method: 'PATCH', signal, body: { version: data.playlist.version, ...changes } }));
  const move = (itemId, offset) => {
    const order = data.items.map(item => item._id), index = order.indexOf(itemId), next = index + offset;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    void edit({ operation: 'reorder', itemIds: order });
  };
  const playPlaylist = itemId => {
    try {
      const context = playablePlaylist(data.items, itemId);
      playTrack(context.tracks[context.startIndex], context.tracks, context.startIndex);
      setNotice(context.skipped ? `${context.skipped} unavailable playlist entries were skipped.` : 'Playlist added to the player queue.');
    } catch (failure) { setError(failure.message); }
  };
  const deletePlaylist = () => {
    if (!window.confirm('Delete this music playlist? Your songs and original files will be kept.')) return;
    void mutate(async signal => {
      await musicLibraryRequest(`/playlists/${playlistId}`, { method: 'DELETE', signal, body: { version: data.playlist.version } });
      if (!signal.aborted) setParams({ view: 'playlists' });
    });
  };
  const playSaved = row => {
    const records = data.items.filter(item => item.record).map(item => item.record);
    playTrack(row.record, records, data.items.filter(item => item.record).findIndex(item => item._id === row._id));
  };
  return <div className={`music-collections ${playlistId ? 'playlist-detail' : ''}`}>
    <header><span className="badge-mono">YOUR PRIVATE LIBRARY</span><h1>{playlistId ? 'Playlist' : 'Your library'}</h1>{!playlistId && <p>Saved by you. Played by you.</p>}<button className="btn-secondary" disabled={busy} onClick={refresh}>Refresh</button></header>
    {!playlistId && <nav className="music-collection-tabs" aria-label="Personal music collections">{Object.entries(views).map(([key, label]) => <Link key={key} to={`/music/collections?view=${key}`} aria-current={view === key && !playlistId ? 'page' : undefined}>{label}</Link>)}<Link to="/music">All music</Link></nav>}
    {playlistId && <Link className="playlist-back-link" to="/library">← Your library</Link>}
    {error && <div role="alert"><p>{error}</p><button className="btn-secondary" onClick={refresh}>Refresh library</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!playlistId && view === 'playlists' && <details className="music-playlist-create"><summary>Create a playlist</summary><form className="music-playlist-form glass-panel" onSubmit={create}>
      <h2>Create a playlist</h2><label>Name<input className="form-input" required maxLength={200} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <label>Description<input className="form-input" maxLength={2000} value={description} disabled={busy} onChange={event => setDescription(event.target.value)} /></label><button className="btn-primary" disabled={busy || !name.trim()}>Create playlist</button>
    </form></details>}
    {!data && !error && <p role="status">Loading your collection…</p>}
    {data && (playlistId ? <>
      <section className="music-playlist-hero" aria-label="Playlist overview"><div className={`music-playlist-mosaic ${coverTracks.length < 2 ? 'single' : ''}`} aria-hidden="true">{coverTracks.length ? coverTracks.map((track, index) => <MusicArtwork key={`${track._id}:${index}`} src={track.coverImage} title={track.title} />) : <MusicArtwork title={data.playlist.name} />}</div><span className="badge-mono">PRIVATE PLAYLIST</span><h2>{data.playlist.name}</h2>{data.playlist.description && <p>{data.playlist.description}</p>}<p>{data.items.length} entries</p><button className="btn-primary" disabled={!data.items.some(item => item.track)} onClick={() => playPlaylist()}><Play size={18} />Play playlist</button></section>
      <details className="music-playlist-edit"><summary>Edit playlist</summary>
      <form className="music-playlist-form glass-panel" onSubmit={event => { event.preventDefault(); void edit({ operation: 'rename', name, description }); }}>
        <label>Playlist name<input className="form-input" required maxLength={200} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
        <label>Description<input className="form-input" maxLength={2000} value={description} disabled={busy} onChange={event => setDescription(event.target.value)} /></label>
        <div className="music-collection-actions"><button className="btn-secondary" disabled={busy || !name.trim()}>Save details</button><button type="button" className="btn-secondary" disabled={busy} onClick={deletePlaylist}>Delete playlist</button><button type="button" className="btn-primary" disabled={!data.items.some(item => item.track)} onClick={() => playPlaylist()}>Play playlist</button></div>
      </form></details><p>Add songs from All Music or the player. Repeated songs have independent positions.</p>
      <ol className="music-collection-list">{data.items.map((item, index) => <li key={item._id}>
        <button className="music-collection-play" aria-label={`Play ${item.track?.title || 'unavailable song'}`} disabled={!item.track} onClick={() => playPlaylist(item._id)}><Play size={18} /></button>
        <div className="music-collection-description"><strong>{item.track?.title || 'Unavailable song'}</strong><small>{item.track ? artistNames(item.track) : 'The original entry is retained; you can remove it.'}</small></div>
        <button aria-label={`Move playlist entry ${index + 1} up`} disabled={busy || index === 0} onClick={() => move(item._id, -1)}><ArrowUp size={17} /></button><button aria-label={`Move playlist entry ${index + 1} down`} disabled={busy || index === data.items.length - 1} onClick={() => move(item._id, 1)}><ArrowDown size={17} /></button><button aria-label={`Remove playlist entry ${index + 1}`} disabled={busy} onClick={() => void edit({ operation: 'remove', itemIds: [item._id] })}><Trash2 size={17} /></button>
      </li>)}</ol>{!data.items.length && <p>This playlist is empty. <Link to="/music">Choose music to add</Link>.</p>}
    </> : <>
      {!data.items.length && <p>No {views[view].toLowerCase()} yet. <Link to="/music">Browse your songs</Link>.</p>}
      <ul className="music-collection-list">{data.items.map(row => <li key={row._id}>
        {view === 'playlists' ? <div className="music-collection-description"><Link to={`/music/collections?view=playlists&playlistId=${row._id}`}><strong>{row.name}</strong></Link><small>{row.itemCount} songs · {row.description}</small></div>
          : <>{row.record && <MusicArtwork src={row.record.coverImage} title={row.record.title || row.record.name} />}
            <div className="music-collection-description"><strong>{row.record?.title || row.record?.name || row.title || 'Unavailable music'}</strong><small>{['likes', 'history'].includes(view) && row.record ? artistNames(row.record) : ''}{view === 'history' ? ` · ${row.outcome === 'completed' ? 'Reached the end' : row.outcome === 'skipped' ? 'Stopped / skipped' : 'Started'} · ${formatMusicTime(row.playedSeconds)} listened · ${new Date(row.startedAt).toLocaleString()}` : ''}</small></div>
            {['likes', 'history'].includes(view) ? <><button className="music-collection-play" disabled={!row.record} aria-label="Play song" onClick={() => playSaved(row)}><Play size={18} /></button><button disabled={!row.record} onClick={() => addToMusicQueue(row.record)}>Queue</button></>
              : row.record && <Link to={`/music?view=tracks&${view === 'albums' ? 'albumId' : 'artistId'}=${row.record._id}`}>View songs</Link>}
            {view !== 'history' && <button aria-label="Remove saved item" disabled={busy} onClick={() => void mutate(signal => musicLibraryRequest(`${paths[view]}/entries/${row._id}`, { method: 'DELETE', signal }))}><Trash2 size={17} /></button>}
          </>}
      </li>)}</ul>
      <div className="music-collection-actions"><button className="btn-secondary" disabled={page <= 1} onClick={() => setParams({ view, page: String(page - 1) })}>Previous</button><span>Page {page} of {Math.max(1, data.totalPages)}</span><button className="btn-secondary" disabled={page >= data.totalPages} onClick={() => setParams({ view, page: String(page + 1) })}>Next</button></div>
    </>)}
  </div>;
}
