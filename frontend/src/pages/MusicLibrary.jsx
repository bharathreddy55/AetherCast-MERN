import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Music, Play, Pause, ArrowLeft, ArrowRight, ListPlus, CornerDownRight, Heart, ListMusic } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { API_BASE_URL } from '../lib/config';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import MusicArtwork from '../components/MusicArtwork';
import { artistNames, formatMusicTime, sameMedia } from '../lib/musicPlayback';
import './MusicLibrary.css';
import { loadMusicContext } from '../lib/musicQueue';
import { useMusicLibraryState } from '../lib/useMusicLibraryState';
import PlaylistPicker from '../components/PlaylistPicker';

export default function MusicLibrary() {
  const [params, setParams] = useSearchParams();
  const view = ['tracks', 'albums', 'artists'].includes(params.get('view')) ? params.get('view') : 'tracks';
  const pageValue = params.get('page');
  const page = pageValue && /^\d+$/.test(pageValue) ? Math.min(10000, Math.max(1, Number(pageValue))) : 1;
  const search = params.get('search') || '';
  const albumId = view === 'tracks' ? params.get('albumId') : null;
  const artistId = view === 'tracks' ? params.get('artistId') : null;
  const sort = albumId ? 'album' : ['title', 'recent'].includes(params.get('sort')) ? params.get('sort') : view === 'tracks' ? 'recent' : 'title';
  const focusSearch = params.get('focus') === 'search';
  const searchInput = useRef(null);
  const { user } = useAuth();
  const [draft, setDraft] = useState(search);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueNotice, setQueueNotice] = useState('');
  const [playlistTrack, setPlaylistTrack] = useState(null);
  const selectionRef = useRef(null);
  const cancelSelection = useCallback(() => selectionRef.current?.abort(), []);
  const { playTrack, addToMusicQueue, currentEpisode, isPlaying, togglePlay } = usePlayer();
  const query = new URLSearchParams({ page: String(page), limit: '50', sort, ...(search ? { search } : {}), ...(albumId ? { albumId } : {}), ...(artistId ? { artistId } : {}) }).toString();
  const identity = `${view}?${query}`;
  useEffect(() => () => cancelSelection(), [identity, cancelSelection]);
  useEffect(() => { setDraft(search); }, [search]);
  useEffect(() => { if (focusSearch) searchInput.current?.focus(); }, [focusSearch]);
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setResult(null);
    (async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/music/${identity}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load your music.');
        if (!controller.signal.aborted) setResult({ ...data, identity });
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
    })();
    return () => controller.abort();
  }, [identity, refresh]);
  const data = result?.identity === identity ? result : null;
  const items = data?.[view] || [];
  const library = useMusicLibraryState(items, view);
  const goPage = number => { const next = new URLSearchParams(params); next.set('page', String(number)); setParams(next); };
  const play = async track => {
    selectionRef.current?.abort();
    setQueueNotice('');
    if (track && sameMedia(track, currentEpisode)) { setQueueLoading(false); togglePlay(); return; }
    const controller = new AbortController(); selectionRef.current = controller;
    setQueueLoading(true);
    try {
      const tracks = await loadMusicContext({ signal: controller.signal, fetchPage: (number, signal) => {
        const context = new URLSearchParams(query); context.set('page', String(number)); context.set('limit', '100');
        return apiFetch(`${API_BASE_URL}/music/tracks?${context}`, { signal });
      } });
      if (!controller.signal.aborted && tracks.length) playTrack(track || tracks[0], tracks);
    } catch (failure) { if (!controller.signal.aborted) setQueueNotice(failure.message); }
    finally { if (selectionRef.current === controller) setQueueLoading(false); }
  };
  const enqueue = (track, next) => {
    cancelSelection(); setQueueLoading(false);
    if (addToMusicQueue(track, next)) setQueueNotice(next ? `${track.title} will play next.` : `${track.title} added to your queue.`);
  };
  return <div className="music-library">
    <header className="music-library-welcome"><div><span className="badge-mono">MADE FOR YOUR EVERYDAY</span><h1>Your music, your moment.</h1><p>Welcome, {user?.name?.split(' ')[0] || 'music lover'}. Find your next favorite in your own collection.</p></div><Link className="btn-primary" to="/music/import">Import music</Link></header>
    <nav className="music-library-tabs" aria-label="Music collections">{[['tracks', 'Songs'], ['albums', 'Albums'], ['artists', 'Artists']].map(([key, label]) => <Link key={key} to={`/music?view=${key}`} aria-current={view === key && !albumId && !artistId ? 'page' : undefined}>{label}</Link>)}<Link to="/music/collections?view=likes">Liked</Link><Link to="/music/collections?view=playlists">Playlists</Link><Link to="/music/collections?view=history">History</Link></nav>
    {(albumId || artistId) && <p>Showing {albumId ? 'album songs in disc and track order' : 'songs by this artist'}. <Link to="/music">Show all songs</Link></p>}
    <form className="music-library-search" onSubmit={event => { event.preventDefault(); const next = new URLSearchParams(params); next.set('search', draft.trim()); next.delete('page'); setParams(next); }}>
      <label htmlFor="music-search" className="music-search-label">Search {view === 'tracks' ? 'song titles' : view}</label><input ref={searchInput} id="music-search" className="form-input" value={draft} maxLength={200} onChange={event => setDraft(event.target.value)} placeholder={`Search ${view === 'tracks' ? 'songs' : view}`} /><button className="btn-secondary">Search</button>
      <button type="button" className="btn-secondary" onClick={() => setRefresh(value => value + 1)}>Refresh</button>
      {!albumId && <label className="music-sort-label">Sort<select value={sort} onChange={event => { const next = new URLSearchParams(params); next.set('sort', event.target.value); next.delete('page'); setParams(next); }}><option value="recent">Recently added</option><option value="title">A–Z</option></select></label>}
    </form>
    {queueLoading && <p role="status">Loading the complete listening queue… <button className="btn-secondary" onClick={() => { cancelSelection(); setQueueLoading(false); }}>Cancel</button></p>}
    {queueNotice && <p role="status">{queueNotice}</p>}
    {library.error && <p role="alert">{library.error} <button className="btn-secondary" onClick={library.reload}>Retry library state</button></p>}
    {error ? <div role="alert"><p>{error}</p><button className="btn-secondary" onClick={() => setRefresh(value => value + 1)}>Try again</button></div> : !data ? <p role="status">Loading music…</p> : <>
      {!items.length ? <div className="music-library-empty"><Music size={40} /><h2>{search || albumId || artistId ? 'No matching music' : 'Your collection starts here'}</h2><p>{search || albumId || artistId ? 'Try another search or return to all songs.' : 'Import your first songs, then confirm their details to see them here.'}</p><Link to="/music/import">Import songs</Link></div> : view === 'tracks' ? <>
        {!albumId && !artistId && !search && page === 1 && sort === 'recent' && <section className="music-fresh-section" aria-label="Recently added music"><h2>Fresh from your library</h2><div className="music-fresh-grid">{items.slice(0, 4).map(track => <button className="music-fresh-card" key={track._id} onClick={() => play(track)}><MusicArtwork src={track.coverImage} title={track.title} /><span><strong>{track.title}</strong><small>{artistNames(track)}</small></span><span className="music-fresh-play">{sameMedia(track, currentEpisode) && isPlaying ? <Pause size={18} /> : <Play size={18} />}</span></button>)}</div></section>}
        <div className="music-list-heading"><div><h2>{albumId ? 'Album songs' : artistId ? 'Artist songs' : 'Your songs'}</h2><p>{data.total} songs · {sort === 'album' ? 'Album order' : sort === 'recent' ? 'Recently added' : 'A–Z'}</p></div><button className="btn-primary" disabled={queueLoading} onClick={() => play()}><Play size={16} />{albumId ? 'Play album' : 'Play collection'}</button></div>
        <ol className="music-song-list">{items.map(track => <li key={track._id} className={sameMedia(track, currentEpisode) ? 'current' : ''}>
          <button className="music-song-play" aria-label={`${sameMedia(track, currentEpisode) && isPlaying ? 'Pause' : 'Play'} ${track.title}`} onClick={() => play(track)}>{sameMedia(track, currentEpisode) && isPlaying ? <Pause size={18} /> : <Play size={18} />}</button>
          <MusicArtwork className="music-song-art" src={track.coverImage} title={track.title} />
          <div className="music-song-title"><strong>{track.title}{track.explicit && <small aria-label="Explicit content"> E</small>}</strong><span>{artistNames(track)}</span></div>
          <div className="music-song-album">{track.album && <Link to={`/music?view=tracks&albumId=${encodeURIComponent(track.album._id)}`}>{track.album.title}</Link>}{albumId && <small>Disc {track.discNumber} · Track {track.trackNumber}</small>}</div>
          <span className="music-song-duration">{formatMusicTime(track.duration)}</span>
          <div className="music-song-queue-actions"><button aria-label={`${library.saved.includes(track._id) ? 'Unlike' : 'Like'} ${track.title}`} aria-pressed={library.saved.includes(track._id)} disabled={!library.ready || library.busy.includes(track._id)} title="Like song" onClick={() => void library.toggle(track._id)}><Heart size={17} fill={library.saved.includes(track._id) ? 'currentColor' : 'none'} /></button><button aria-label={`Add ${track.title} to a playlist`} title="Add to playlist" onClick={() => setPlaylistTrack(track)}><ListMusic size={17} /></button><button aria-label={`Play ${track.title} next`} title="Play next" onClick={() => enqueue(track, true)}><CornerDownRight size={17} /></button><button aria-label={`Add ${track.title} to queue`} title="Add to queue" onClick={() => enqueue(track, false)}><ListPlus size={17} /></button></div>
        </li>)}</ol><p className="music-queue-note">Playback loads this complete filtered collection across pages, up to 2,000 songs. Open the player queue to reorder or remove upcoming songs.</p>
      </> : <div className="music-catalog-grid">{items.map(item => <article className="glass-panel music-catalog-card" key={item._id}><Link to={`/music?view=tracks&${view === 'albums' ? 'albumId' : 'artistId'}=${encodeURIComponent(item._id)}`}>
        <MusicArtwork className="music-catalog-art" src={item.coverImage} title={item.title || item.name} /><h2>{item.title || item.name}</h2><p>{view === 'albums' ? item.artists.map(artist => artist.name).join(', ') || (item.isCompilation ? 'Various artists' : 'Unknown artist') : 'View songs'}</p></Link>
        <button className="btn-secondary" disabled={!library.ready || library.busy.includes(item._id)} aria-pressed={library.saved.includes(item._id)} onClick={() => void library.toggle(item._id)}>{view === 'albums' ? library.saved.includes(item._id) ? 'Saved album' : 'Save album' : library.saved.includes(item._id) ? 'Following' : 'Follow artist'}</button>
      </article>)}</div>}
      <div className="music-library-pagination"><button className="btn-secondary" disabled={page <= 1} onClick={() => goPage(page - 1)}><ArrowLeft size={16} /> Previous</button><span>Page {page} of {Math.max(1, data.totalPages)}</span><button className="btn-secondary" disabled={page >= data.totalPages} onClick={() => goPage(page + 1)}>Next <ArrowRight size={16} /></button></div>
    </>}
    {playlistTrack && <PlaylistPicker track={playlistTrack} onClose={() => setPlaylistTrack(null)} />}
  </div>;
}
