import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Heart, ListMusic, ListPlus, Play } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { API_BASE_URL } from '../lib/config';
import { musicSearchState, musicSearchParams, musicSearchHref, musicSearchGroups, createMusicSearchLoader } from '../lib/musicSearch';
import { usePlayer } from '../context/PlayerContext';
import { useMusicLibraryState } from '../lib/useMusicLibraryState';
import { artistNames, formatMusicTime } from '../lib/musicPlayback';
import MusicArtwork from '../components/MusicArtwork';
import PlaylistPicker from '../components/PlaylistPicker';
import './MusicSearch.css';

function SearchSongs({ items }) {
  const { playTrack, addToMusicQueue } = usePlayer();
  const library = useMusicLibraryState(items);
  const [picked, setPicked] = useState(null), [notice, setNotice] = useState('');
  return <>{library.error && <p role="alert">{library.error} <button onClick={library.reload}>Retry saved state</button></p>}
    {notice && <p role="status">{notice}</p>}
    <ul className="music-search-songs">{items.map(track => <li key={track._id}>
      <button aria-label={`Play ${track.title}`} onClick={() => playTrack(track)}><Play size={18} /></button>
      <MusicArtwork src={track.coverImage} title={track.title} />
      <div className="music-search-result-label"><strong>{track.title}</strong><small>{artistNames(track)}{track.album && <> · <Link to={`/music?view=tracks&albumId=${track.album._id}`}>{track.album.title}</Link></>} · {formatMusicTime(track.duration)}</small></div>
      <div className="music-search-actions">
        <button aria-label={`${library.saved.includes(track._id) ? 'Unlike' : 'Like'} ${track.title}`} aria-pressed={library.saved.includes(track._id)} disabled={!library.ready || library.busy.includes(track._id)} onClick={() => void library.toggle(track._id)}><Heart size={18} fill={library.saved.includes(track._id) ? 'currentColor' : 'none'} /></button>
        <button aria-label={`Add ${track.title} to a playlist`} onClick={() => setPicked(track)}><ListMusic size={18} /></button>
        <button aria-label={`Add ${track.title} to queue`} onClick={() => { if (addToMusicQueue(track)) setNotice(`${track.title} added to your queue.`); }}><ListPlus size={18} /></button>
      </div>
    </li>)}</ul>{picked && <PlaylistPicker track={picked} onClose={() => setPicked(null)} />}
  </>;
}
function SearchCards({ items, group }) {
  const library = useMusicLibraryState(group === 'playlists' ? [] : items, group === 'artists' ? 'artists' : 'albums');
  return <>{library.error && <p role="alert">{library.error} <button onClick={library.reload}>Retry saved state</button></p>}
    <ul className="music-search-cards">{items.map(item => <li key={item._id} className="glass-panel">
      <Link to={group === 'playlists' ? `/music/collections?view=playlists&playlistId=${item._id}` : `/music?view=tracks&${group === 'artists' ? 'artistId' : 'albumId'}=${item._id}`}>
        {group !== 'playlists' && <MusicArtwork src={item.coverImage} title={item.name || item.title} />}
        <strong>{item.name || item.title}</strong><small>{group === 'playlists' ? `${item.itemCount} entries` : group === 'artists' ? 'View artist songs' : item.artists.map(artist => artist.name).join(', ') || 'Various artists'}</small>
      </Link>
      {group !== 'playlists' && <button className="btn-secondary" aria-pressed={library.saved.includes(item._id)} disabled={!library.ready || library.busy.includes(item._id)} onClick={() => void library.toggle(item._id)}>{group === 'artists' ? library.saved.includes(item._id) ? 'Following' : 'Follow artist' : library.saved.includes(item._id) ? 'Saved' : 'Save album'}</button>}
    </li>)}</ul>
  </>;
}
export default function MusicSearch() {
  const [params, setParams] = useSearchParams();
  const state = musicSearchState(params), query = musicSearchParams(state);
  const [draft, setDraft] = useState(state.q), [result, setResult] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { setDraft(state.q); }, [state.q]);
  const valid = Boolean(state.q.trim()) && state.q.length <= 200;
  useEffect(() => {
    setResult(null); setError('');
    if (!valid) return;
    const loader = createMusicSearchLoader({ request: (key, options) => apiFetch(`${API_BASE_URL}/music/search?${key}`, options),
      onResult: (data, key) => setResult({ ...data, key }), onError: setError });
    void loader.load(query);
    return () => loader.cancel();
  }, [query, valid, revision]);
  const data = result?.key === query ? result : null;
  const navigate = changes => setParams(new URLSearchParams(musicSearchParams({ ...state, page: 1, ...changes })));
  return <div className="music-search-page">
    <header><span className="badge-mono">YOUR PRIVATE COLLECTION</span><h1>Find your next listen.</h1><p>Search song titles, artist names, album titles and playlist names.</p></header>
    <form className="music-search-form" onSubmit={event => { event.preventDefault(); navigate({ q: draft.trim() }); }}>
      <label htmlFor="grouped-music-search">Search your library</label><input id="grouped-music-search" className="form-input" ref={input} value={draft} maxLength={200} onChange={event => setDraft(event.target.value)} placeholder="A song, artist, album or playlist" /><button className="btn-primary">Search</button>
      <button type="button" className="btn-secondary" onClick={() => { setDraft(''); navigate({ q: '' }); input.current?.focus(); }}>Clear</button>
      <button type="button" className="btn-secondary" disabled={!valid} onClick={() => setRevision(value => value + 1)}>Refresh results</button>
      <label>Sort<select value={state.sort} onChange={event => navigate({ sort: event.target.value })}><option value="title">A–Z</option><option value="recent">Recently added</option></select></label>
    </form>
    <nav className="music-search-tabs" aria-label="Search categories">{Object.entries({ all: 'All', ...musicSearchGroups }).map(([group, label]) => <Link key={group} to={musicSearchHref(state, { group })} aria-current={state.group === group ? 'page' : undefined}>{label}</Link>)}</nav>
    {!valid ? <p>{state.q.length > 200 ? 'Use at most 200 characters.' : 'Enter a name to search your imported music and private playlists.'}</p> : error ? <div role="alert"><p>{error}</p><button className="btn-secondary" onClick={() => setRevision(value => value + 1)}>Retry search</button></div> : !data ? <p role="status">Searching your library…</p> : <>
      {Object.values(data.groups).every(group => !group.total) && <p role="status">No matches for “{data.q}”. Try another name or <Link to="/music/import">import music</Link>.</p>}
      {Object.entries(data.groups).map(([group, results]) => <section key={`${query}:${group}`} aria-labelledby={`search-${group}`}>
        <div className="music-search-heading"><h2 id={`search-${group}`}>{musicSearchGroups[group]} <small>({results.total})</small></h2>{state.group === 'all' && results.total > results.items.length && <Link to={musicSearchHref(state, { group })}>View all {musicSearchGroups[group].toLowerCase()}</Link>}</div>
        {!results.items.length ? <p>No matching {musicSearchGroups[group].toLowerCase()} on this page.</p> : group === 'tracks' ? <SearchSongs items={results.items} /> : <SearchCards items={results.items} group={group} />}
        {state.group !== 'all' && <div className="music-search-pagination"><button className="btn-secondary" disabled={state.page <= 1} onClick={() => navigate({ page: state.page - 1 })}>Previous</button><span>Page {state.page} of {Math.max(1, results.totalPages)}</span><button className="btn-secondary" disabled={state.page >= results.totalPages || state.page >= 1000} onClick={() => navigate({ page: state.page + 1 })}>Next</button></div>}
      </section>)}
      <p>Playing a search result starts that song. Use Queue to build your next-up list, or open an album or playlist to play its full context.</p>
    </>}
  </div>;
}
