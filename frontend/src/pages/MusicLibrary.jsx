import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Music, Play, Pause, ArrowLeft, ArrowRight } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { API_BASE_URL } from '../lib/config';
import { usePlayer } from '../context/PlayerContext';
import { artistNames, formatMusicTime, sameMedia } from '../lib/musicPlayback';
import './MusicLibrary.css';

export default function MusicLibrary() {
  const [params, setParams] = useSearchParams();
  const view = ['tracks', 'albums', 'artists'].includes(params.get('view')) ? params.get('view') : 'tracks';
  const pageValue = params.get('page');
  const page = pageValue && /^\d+$/.test(pageValue) ? Math.min(10000, Math.max(1, Number(pageValue))) : 1;
  const search = params.get('search') || '';
  const albumId = view === 'tracks' ? params.get('albumId') : null;
  const artistId = view === 'tracks' ? params.get('artistId') : null;
  const [draft, setDraft] = useState(search);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { playTrack, currentEpisode, isPlaying, togglePlay } = usePlayer();
  const query = new URLSearchParams({ page: String(page), limit: '50', sort: albumId ? 'album' : 'title', ...(search ? { search } : {}), ...(albumId ? { albumId } : {}), ...(artistId ? { artistId } : {}) }).toString();
  const identity = `${view}?${query}`;
  useEffect(() => { setDraft(search); }, [search]);
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
  const goPage = number => { const next = new URLSearchParams(params); next.set('page', String(number)); setParams(next); };
  const play = track => { if (sameMedia(track, currentEpisode)) togglePlay(); else playTrack(track, items); };
  return <div className="music-library">
    <header><span className="badge-mono">YOUR PRIVATE COLLECTION</span><h1>Your music</h1><p>Songs you own, ready to listen.</p><Link className="btn-primary" to="/music/import">Import Music</Link></header>
    <nav className="music-library-tabs" aria-label="Music collections">{[['tracks', 'Songs'], ['albums', 'Albums'], ['artists', 'Artists']].map(([key, label]) => <Link key={key} to={`/music?view=${key}`} aria-current={view === key && !albumId && !artistId ? 'page' : undefined}>{label}</Link>)}</nav>
    {(albumId || artistId) && <p>Showing {albumId ? 'album songs in disc and track order' : 'songs by this artist'}. <Link to="/music">Show all songs</Link></p>}
    <form className="music-library-search" onSubmit={event => { event.preventDefault(); const next = new URLSearchParams(params); next.set('search', draft.trim()); next.delete('page'); setParams(next); }}>
      <label htmlFor="music-search">Search {view === 'tracks' ? 'song titles' : view}</label><input id="music-search" className="form-input" value={draft} maxLength={200} onChange={event => setDraft(event.target.value)} placeholder="Search your collection" /><button className="btn-secondary">Search</button>
      <button type="button" className="btn-secondary" onClick={() => setRefresh(value => value + 1)}>Refresh</button>
    </form>
    {error ? <div role="alert"><p>{error}</p><button className="btn-secondary" onClick={() => setRefresh(value => value + 1)}>Try again</button></div> : !data ? <p role="status">Loading music…</p> : <>
      {!items.length ? <div className="music-library-empty"><Music size={40} /><h2>{search || albumId || artistId ? 'No matching music' : 'Your collection starts here'}</h2><p>{search || albumId || artistId ? 'Try another search or return to all songs.' : 'Import your first songs, then confirm their details to see them here.'}</p><Link to="/music/import">Import songs</Link></div> : view === 'tracks' ? <>
        <div className="music-list-heading"><p>{data.total} songs · {albumId ? 'Album order' : 'Title order'}</p><button className="btn-primary" onClick={() => playTrack(items[0], items)}>Play these {items.length} songs</button></div>
        <ol className="music-song-list">{items.map(track => <li key={track._id} className={sameMedia(track, currentEpisode) ? 'current' : ''}>
          <button className="music-song-play" aria-label={`${sameMedia(track, currentEpisode) && isPlaying ? 'Pause' : 'Play'} ${track.title}`} onClick={() => play(track)}>{sameMedia(track, currentEpisode) && isPlaying ? <Pause size={18} /> : <Play size={18} />}</button>
          <div className="music-song-art">{track.coverImage ? <img src={window.getMediaUrl(track.coverImage)} alt="" loading="lazy" /> : <Music size={20} />}</div>
          <div className="music-song-title"><strong>{track.title}{track.explicit && <small aria-label="Explicit content"> E</small>}</strong><span>{artistNames(track)}</span></div>
          <div className="music-song-album">{track.album && <Link to={`/music?view=tracks&albumId=${encodeURIComponent(track.album._id)}`}>{track.album.title}</Link>}{albumId && <small>Disc {track.discNumber} · Track {track.trackNumber}</small>}</div>
          <span className="music-song-duration">{formatMusicTime(track.duration)}</span>
        </li>)}</ol><p className="music-queue-note">The player queue contains the songs on this page. Open another page to choose more songs.</p>
      </> : <div className="music-catalog-grid">{items.map(item => <Link className="glass-panel music-catalog-card" key={item._id} to={`/music?view=tracks&${view === 'albums' ? 'albumId' : 'artistId'}=${encodeURIComponent(item._id)}`}>
        <div className="music-catalog-art">{item.coverImage ? <img src={window.getMediaUrl(item.coverImage)} alt="" loading="lazy" /> : <Music size={48} />}</div><h2>{item.title || item.name}</h2><p>{view === 'albums' ? item.artists.map(artist => artist.name).join(', ') || (item.isCompilation ? 'Various artists' : 'Unknown artist') : 'View songs'}</p>
      </Link>)}</div>}
      <div className="music-library-pagination"><button className="btn-secondary" disabled={page <= 1} onClick={() => goPage(page - 1)}><ArrowLeft size={16} /> Previous</button><span>Page {page} of {Math.max(1, data.totalPages)}</span><button className="btn-secondary" disabled={page >= data.totalPages} onClick={() => goPage(page + 1)}>Next <ArrowRight size={16} /></button></div>
    </>}
  </div>;
}
