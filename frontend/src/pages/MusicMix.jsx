import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { musicLibraryRequest } from '../lib/musicLibraryApi';
import { artistNames } from '../lib/musicPlayback';
import MusicArtwork from '../components/MusicArtwork';
import './MusicMix.css';

export default function MusicMix() {
  const { playTrack, addToMusicQueue } = usePlayer();
  const [mix, setMix] = useState(null), [excluded, setExcluded] = useState(null), [page, setPage] = useState(1);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const mutation = useRef(null), alive = useRef(true);
  const dispose = useCallback(() => { alive.current = false; mutation.current?.abort(); }, []);
  useEffect(() => { alive.current = true; return dispose; }, [dispose]);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setMix(null); setExcluded(null);
    Promise.allSettled([musicLibraryRequest('/recommendations', { signal: controller.signal }), musicLibraryRequest(`/recommendations/exclusions?page=${page}&limit=25`, { signal: controller.signal })])
      .then(([data, exclusions]) => {
        if (controller.signal.aborted) return;
        if (data.status === 'fulfilled') setMix(data.value);
        if (exclusions.status === 'fulfilled') setExcluded(exclusions.value);
        setError([data, exclusions].filter(result => result.status === 'rejected').map(result => result.reason.message).join(' '));
      });
    return () => controller.abort();
  }, [revision, page]);
  const mutate = async (path, method) => {
    if (busy) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError(''); setNotice('');
    try { await musicLibraryRequest(path, { method, signal: controller.signal }); if (!controller.signal.aborted && alive.current) { setRevision(value => value + 1); setNotice('Your mix preferences were saved.'); } }
    catch (failure) { if (!controller.signal.aborted && alive.current) setError(failure.message); }
    finally { if (!controller.signal.aborted && alive.current) setBusy(false); }
  };
  return <div className="music-mix-page"><header><span className="badge-mono">FROM YOUR OWN LIBRARY</span><h1>Your library mix</h1><p>Local rules, with a reason for every song. Likes and listening time build preferences; recent plays and quick skips lower priority. Artist variety adjusts the final order.</p><Link to="/music">Browse all music</Link></header>
    <button className="btn-secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh mix</button>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!mix && !error && <p role="status">Building your library mix…</p>}
    {mix && <><p>{mix.method}</p><p>{mix.availableSongs} songs have ready audio · {mix.sampledSessions} sampled sessions · {mix.exclusionCount} exclusions. With little history, picks use availability and recency.</p>
      <button className="btn-primary" disabled={!mix.items.length} onClick={() => playTrack(mix.items[0].track, mix.items.map(item => item.track))}>Play mix</button>
      {!mix.items.length && <p>No eligible songs. Import music or restore exclusions below.</p>}
      <ol className="music-mix-list">{mix.items.map(({ track, reasons, score }, index) => <li key={track._id}>
        <MusicArtwork src={track.coverImage} title={track.title} /><div><strong>{track.title}</strong><p>{artistNames(track)}</p><p>{reasons.join(' · ')}</p><small>Rule score: {score} · order also balances artists</small></div>
        <div className="music-mix-actions"><button onClick={() => playTrack(track, mix.items.map(item => item.track), index)}>Play song</button><button onClick={() => { if (addToMusicQueue(track)) setNotice(`${track.title} added to your queue.`); }}>Queue</button><button disabled={busy} onClick={() => void mutate(`/recommendations/exclusions/tracks/${track._id}`, 'PUT')}>Exclude song</button>
          {track.artistCredits.filter(credit => credit.artist?.name).map(credit => <button key={credit.artist._id} disabled={busy} onClick={() => void mutate(`/recommendations/exclusions/artists/${credit.artist._id}`, 'PUT')}>Exclude {credit.artist.name}</button>)}
        </div>
      </li>)}</ol></>}
    <section aria-label="Recommendation exclusions"><h2>Excluded from mixes</h2><p>Exclusions affect these recommendations. Your library, playlists and manual playback stay available.</p>
      {excluded && <><ul>{excluded.items.map(item => <li key={item._id}>{item.kind === 'Artist' ? 'Artist' : 'Song'}: {item.name} <button disabled={busy} onClick={() => void mutate(`/recommendations/exclusions/${item._id}`, 'DELETE')}>Restore to mixes</button></li>)}</ul>{!excluded.items.length && <p>No exclusions on this page.</p>}
        <div className="music-mix-actions"><button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>Previous exclusions</button><span>Page {page} of {Math.max(1, excluded.totalPages)}</span><button disabled={busy || page >= excluded.totalPages} onClick={() => setPage(page + 1)}>Next exclusions</button></div></>}
    </section>
  </div>;
}
