import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { API_BASE_URL } from '../lib/config';
import { usePlayer } from '../context/PlayerContext';
import { activeLyricTime, lyricSeekPosition, readLyricFile } from '../lib/musicLyrics';
import './MusicLyrics.css';

export default function MusicLyrics({ track }) {
  const { currentTime, duration, seek } = usePlayer();
  const [data, setData] = useState(null), [draft, setDraft] = useState(null), [editing, setEditing] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [follow, setFollow] = useState(false);
  const active = useRef(null), mutation = useRef(null), alive = useRef(true), fileRead = useRef(0);
  const dispose = useCallback(() => { alive.current = false; mutation.current?.abort(); ++fileRead.current; }, []);
  useEffect(() => { alive.current = true; return dispose; }, [dispose]);
  const request = async options => {
    const response = await apiFetch(`${API_BASE_URL}/music/tracks/${track._id}/lyrics`, options);
    const value = await response.json();
    if (!response.ok || !value.success) throw new Error(value.message || 'Unable to load or save lyrics.');
    return value.lyrics;
  };
  useEffect(() => {
    const controller = new AbortController(); setData(null); setDraft(null); setEditing(false); setError('');
    (async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/music/tracks/${track._id}/lyrics`, { signal: controller.signal });
        const value = await response.json();
        if (!response.ok || !value.success) throw new Error(value.message || 'Unable to load lyrics.');
        if (!controller.signal.aborted) { setData(value.lyrics); setDraft(value.lyrics); }
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
    })();
    return () => controller.abort();
  }, [track._id, revision]);
  const time = data ? activeLyricTime(data.lines, currentTime, data.offsetMs) : null;
  useEffect(() => {
    if (follow && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) active.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [time, follow]);
  const save = async method => {
    if (busy || !data) return;
    const controller = new AbortController(); mutation.current = controller; ++fileRead.current; setBusy(true); setError('');
    try {
      const lyrics = await request({ method, signal: controller.signal, body: JSON.stringify(method === 'DELETE' ? { version: data.version } : { version: data.version, content: draft.content, format: draft.format, source: draft.source, offsetMs: Number(draft.offsetMs) }), headers: { 'Content-Type': 'application/json' } });
      if (!controller.signal.aborted && alive.current) { setData(lyrics); setDraft(lyrics); setEditing(false); }
    } catch (failure) { if (!controller.signal.aborted && alive.current) setError(failure.message); }
    finally { if (!controller.signal.aborted && alive.current) setBusy(false); }
  };
  const upload = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    const sequence = ++fileRead.current;
    try { const value = await readLyricFile(file); if (alive.current && sequence === fileRead.current) { setDraft(previous => ({ ...previous, ...value })); setError(''); } }
    catch (failure) { if (alive.current && sequence === fileRead.current) setError(failure.message); }
    event.target.value = '';
  };
  return <section className="music-lyrics" aria-label={`Lyrics for ${track.title}`}>
    <h3>Lyrics · {track.title}</h3>{error && <p role="alert">{error}</p>}
    <button disabled={busy} onClick={() => { ++fileRead.current; setRevision(value => value + 1); }}>Reload saved lyrics</button>
    {!data ? !error && <p role="status">Loading lyrics…</p> : <>
      <button disabled={busy} onClick={() => { ++fileRead.current; setDraft(data); setEditing(value => !value); }}>{editing ? 'Cancel editing' : data.content ? 'Edit lyrics' : 'Add your lyrics'}</button>
      {editing ? <form onSubmit={event => { event.preventDefault(); void save('PUT'); }}>
        <label>Import UTF-8 text or LRC<input type="file" accept=".txt,.lrc,text/plain" disabled={busy} onChange={upload} /></label>
        <label>Format<select value={draft.format} disabled={busy} onChange={event => { ++fileRead.current; setDraft({ ...draft, format: event.target.value }); }}><option value="plain">Plain text</option><option value="lrc">Timed LRC</option></select></label>
        <label>Lyrics<textarea rows={12} maxLength={50000} value={draft.content} disabled={busy} onChange={event => { ++fileRead.current; setDraft({ ...draft, content: event.target.value }); }} /></label>
        <label>Timing offset (milliseconds; positive delays lyrics)<input type="number" min={-60000} max={60000} step={1} required value={draft.offsetMs} disabled={busy} onChange={event => setDraft({ ...draft, offsetMs: event.target.value })} /></label>
        <label>Source / note<input maxLength={300} value={draft.source} disabled={busy} onChange={event => setDraft({ ...draft, source: event.target.value })} /></label>
        <p>LRC uses [mm:ss.xx] before each line. Remove [offset:…] tags and use the offset field. Uploading changes the draft; Save applies it.</p>
        <button disabled={busy}>{busy ? 'Saving…' : 'Save lyrics'}</button><button type="button" disabled={busy || !data.content} onClick={() => { if (window.confirm('Clear saved lyrics for this song?')) void save('DELETE'); }}>Clear saved lyrics</button>
      </form> : !data.content ? <p>No lyrics saved. Add your own text or timed LRC.</p> : <>
        {data.source && <p>Source / note: {data.source}</p>}
        {data.format === 'plain' ? <pre>{data.content}</pre> : <><label><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} /> Follow active line (off by default)</label><ol>{data.lines.map((line, index) => <li key={index}><button ref={line.at === time && (index === 0 || data.lines[index - 1].at !== time) ? active : undefined} aria-current={line.at === time ? 'true' : undefined} onClick={() => seek(lyricSeekPosition(line.at, data.offsetMs, duration))}>{line.text || '♪'}</button></li>)}</ol></>}
      </>}
    </>}
  </section>;
}
