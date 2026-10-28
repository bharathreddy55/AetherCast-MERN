import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FolderOpen, RefreshCw } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { API_BASE_URL } from '../lib/config';
import { DEFAULT_IMPORT_FORMATS, selectMusicFiles, uploadMusicFiles, reviewPayload } from '../lib/musicImportClient';
import './MusicImports.css';

const base = `${API_BASE_URL}/music/imports`;
async function request(url, options = {}) {
  const response = await apiFetch(url, options);
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok || !data.success) {
    const error = new Error(response.status === 429 ? 'Too many import requests. Please wait before trying again.' : data.message || 'The import request could not be completed.');
    error.retryAfter = Number(response.headers.get('retry-after')) * 1000;
    throw error;
  }
  return data;
}
function ReviewForm({ job, onAction }) {
  const metadata = job.metadata;
  const [form, setForm] = useState(() => ({ title: metadata.title, artists: metadata.artistNames.join('; '),
    album: metadata.albumTitle, albumArtists: metadata.albumArtistNames.join('; '), genres: metadata.genres.join(', '),
    releaseDate: metadata.releaseDate || '', discNumber: metadata.discNumber, trackNumber: metadata.trackNumber,
    language: metadata.language, explicit: metadata.explicit, isCompilation: metadata.isCompilation }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = (name, label, extra = {}) => <label className="music-import-field">{label}<input className="form-input" disabled={busy} name={name} value={form[name]} onChange={event => setForm(current => ({ ...current, [name]: event.target.value }))} {...extra} /></label>;
  const confirm = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onAction(job._id, '/confirm', { metadata: reviewPayload(form) }); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <form onSubmit={confirm} className="music-review-form">
    <div className="music-import-fields">
      {field('title', 'Song title', { required: true, maxLength: 300 })}
      {field('artists', 'Artists — separate names with ;', { required: true })}
      {field('album', 'Album', { maxLength: 300 })}
      {field('albumArtists', 'Album artists — separate names with ;')}
      {field('discNumber', 'Disc number', { type: 'number', min: 1, step: 1, required: true })}
      {field('trackNumber', 'Track number', { type: 'number', min: 1, step: 1, required: true })}
      {field('releaseDate', 'Release date', { type: 'date' })}
      {field('genres', 'Genres — separate with commas')}
      {field('language', 'Language', { maxLength: 64 })}
    </div>
    <div className="music-import-actions">
      <label><input type="checkbox" disabled={busy} checked={form.isCompilation} onChange={event => setForm(current => ({ ...current, isCompilation: event.target.checked }))} /> Compilation album</label>
      <label><input type="checkbox" disabled={busy} checked={form.explicit} onChange={event => setForm(current => ({ ...current, explicit: event.target.checked }))} /> Explicit content</label>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="music-import-actions"><button className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add to my library'}</button>
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => onAction(job._id, '', { cancel: true }).catch(failure => setError(failure.message))}>Cancel import</button></div>
  </form>;
}

export default function MusicImports() {
  const [config, setConfig] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [running, setRunning] = useState(false);
  const [pollDelay, setPollDelay] = useState(5000);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const uploadRef = useRef(null);
  const mountedRef = useRef(false);
  const listRevisionRef = useRef(0);
  const stopUploads = useCallback(() => uploadRef.current?.abort(), []);
  const refresh = useCallback(async () => {
    const revision = ++listRevisionRef.current;
    const data = await request(base);
    if (mountedRef.current && revision === listRevisionRef.current) { setJobs(data.imports); setPollDelay(5000); }
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    request(`${base}/config`, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setConfig(data); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    refresh().catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => { mountedRef.current = false; controller.abort(); stopUploads(); };
  }, [refresh, stopUploads]);
  const processing = jobs.some(job => ['queued', 'processing'].includes(job.status));
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => { refresh().catch(failure => { if (mountedRef.current) { setError(failure.message); setPollDelay(Math.max(15000, failure.retryAfter || 0)); } }); }, pollDelay);
    return () => clearInterval(timer);
  }, [processing, refresh, pollDelay]);
  const chooseFiles = event => {
    try {
      const selection = selectMusicFiles([...event.target.files], config);
      setQueue(selection.files.map(entry => ({ ...entry, key: crypto.randomUUID(), validationError: !!entry.error, status: entry.error ? 'failed' : 'selected' })));
      setError(''); setNotice(selection.skipped ? `Skipped ${selection.skipped} unsupported files.` : '');
    } catch (failure) { setError(failure.message); }
    event.target.value = '';
  };
  const upload = async () => {
    const pending = queue.filter(entry => entry.status === 'selected');
    if (!pending.length) return;
    const controller = new AbortController(); uploadRef.current = controller;
    setRunning(true); setError('');
    await uploadMusicFiles(pending, { signal: controller.signal,
      onUpdate: (key, changes) => { if (mountedRef.current) setQueue(current => current.map(entry => entry.key === key ? { ...entry, ...changes } : entry)); },
      upload: async (file, signal) => { const body = new FormData(); body.append('audio', file); const data = await request(base, { method: 'POST', body, signal }); await refresh().catch(failure => { if (mountedRef.current) setError(failure.message); }); return data; },
    });
    if (mountedRef.current) { setRunning(false); await refresh().catch(failure => setError(failure.message)); }
  };
  const action = async (jobId, suffix, { metadata, cancel = false } = {}) => {
    const result = await request(`${base}/${jobId}${suffix}`, { method: cancel ? 'DELETE' : 'POST',
      ...(metadata ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadata) } : {}) });
    await refresh();
    if (suffix === '/confirm') setNotice(result.duplicate ? 'This song is already in your library.' : 'Song added to your library.');
  };
  const formats = config?.formats || DEFAULT_IMPORT_FORMATS;
  const reload = async () => {
    setError('');
    try { if (!config) setConfig(await request(`${base}/config`)); await refresh(); }
    catch (failure) { setError(failure.message); }
  };
  return <div className="music-import-page">
    <header><span className="badge-mono">YOUR MUSIC</span><h1>Import your music</h1><p>Choose songs or an album folder. Review the details before adding them to your private library.</p></header>
    {error && <p className="music-import-alert" role="alert">{error}</p>}
    {notice && <p className="music-import-alert" role="status">{notice}</p>}
    <section className="glass-panel music-import-panel" aria-label="Select music files">
      <div className="music-import-actions">
        <label className="btn-primary"><Upload size={16} /> Choose songs<input className="music-file-input" aria-label="Choose songs" type="file" multiple accept={formats.map(format => `.${format}`).join(',')} disabled={!config || running} onChange={chooseFiles} /></label>
        <label className="btn-secondary"><FolderOpen size={16} /> Choose folder<input className="music-file-input" aria-label="Choose album folder" type="file" multiple webkitdirectory="" directory="" disabled={!config || running} onChange={chooseFiles} /></label>
      </div>
      <p>{formats.map(format => format.toUpperCase()).join(', ')} · {config ? `${Math.floor(config.maxBytes / 1024 / 1024)} MB per file · up to ${config.maxPending} files at a time` : 'Loading import settings…'}</p>
      {queue.length > 0 && <><ul className="music-upload-list">{queue.map(entry => <li key={entry.key}><span>{entry.file.name}</span><span>{entry.label || entry.status}</span>{entry.error && <small>{entry.error}</small>}{!running && !entry.validationError && ['failed', 'cancelled'].includes(entry.status) && <button className="btn-secondary" onClick={() => setQueue(current => current.map(row => row.key === entry.key ? { ...row, status: 'selected', error: '', label: '' } : row))}>Retry upload</button>}</li>)}</ul>
        <div className="music-import-actions"><button className="btn-primary" disabled={running || !queue.some(entry => entry.status === 'selected')} onClick={upload}>{running ? 'Uploading originals…' : 'Upload selected songs'}</button>
          {running ? <button className="btn-secondary" onClick={() => uploadRef.current?.abort()}>Stop uploads</button> : <button className="btn-secondary" onClick={() => setQueue([])}>Clear file selection</button>}</div></>}
    </section>
    <div className="music-import-heading"><h2>Recent imports</h2><button className="btn-secondary" onClick={reload}><RefreshCw size={15} /> Refresh</button></div>
    {!jobs.length && <p>No imports yet. Choose music files to begin.</p>}
    {jobs.map(job => <section className="glass-panel music-import-panel" key={job._id}>
      <div className="music-import-heading"><h3>{job.metadata?.title || job.originalName}</h3><span className="badge-mono">{({ queued: 'Queued', processing: 'Reading audio', review: 'Ready to review', completed: 'In your library', failed: 'Needs attention', cancelled: 'Cancelled' })[job.status]}</span></div>
      <p className="music-import-filename">{job.originalName}</p>
      {job.error && <p role="status">{job.error}</p>}
      {job.status === 'review' && job.metadata && <ReviewForm job={job} onAction={action} />}
      {['failed', 'cancelled'].includes(job.status) && <button className="btn-secondary" onClick={() => action(job._id, '/retry').catch(failure => setError(failure.message))}>Retry processing</button>}
      {['queued', 'processing'].includes(job.status) && <button className="btn-secondary" onClick={() => action(job._id, '', { cancel: true }).catch(failure => setError(failure.message))}>Cancel import</button>}
    </section>)}
  </div>;
}
