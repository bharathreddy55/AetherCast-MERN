import React, { useCallback, useEffect, useRef, useState } from 'react';
import { musicProcessingRequest } from '../lib/musicProcessing';
import './MusicProcessing.css';
export default function MusicProcessing({ track }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const [actionError, setActionError] = useState('');
  const mutation = useRef(null), alive = useRef(true);
  const dispose = useCallback(() => { alive.current = false; mutation.current?.abort(); }, []);
  useEffect(() => { alive.current = true; return dispose; }, [dispose]);
  useEffect(() => {
    const controller = new AbortController(); let timer;
    const load = async () => {
      try {
        const value = await musicProcessingRequest(`tracks/${track._id}/processing`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setData(value); setError('');
          if (value.jobs.some(job => ['queued', 'processing'].includes(job.status))) timer = setTimeout(load, 10000);
        }
      } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
    };
    void load(); return () => { controller.abort(); clearTimeout(timer); };
  }, [track._id, revision]);
  const change = async (path, method) => {
    if (busy) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setActionError('');
    try { await musicProcessingRequest(path, { method, signal: controller.signal }); if (!controller.signal.aborted && alive.current) setRevision(value => value + 1); }
    catch (failure) { if (!controller.signal.aborted && alive.current) { setActionError(failure.message); setRevision(value => value + 1); } }
    finally { if (!controller.signal.aborted && alive.current) setBusy(false); }
  };
  return <section className="music-processing" aria-label={`Audio and artwork processing for ${track.title}`}><h3>Audio & artwork</h3>
    <p>Prepare a 192 kbps MP3 copy for compatibility and a small artwork thumbnail. Originals stay intact; converting does not increase source quality.</p>
    {(actionError || error) && <p role="alert">{actionError || error}</p>}{!data ? !error && <p role="status">Loading media status…</p> : <>
      {!data.enabled && <p>The backend needs FFmpeg processing enabled before preparing new copies.</p>}
      <button disabled={busy || !data.enabled} onClick={() => void change(`tracks/${track._id}/processing`, 'POST')}>Prepare / retry media</button>
      <ul>{data.jobs.map(job => <li key={job._id}>{job.profile === 'mp3-192-v1' ? 'Compatible MP3' : 'Artwork thumbnail'}: {job.status}{job.error && <p>{job.error}</p>}{['queued', 'processing'].includes(job.status) && <button disabled={busy} onClick={() => void change(`processing/${job._id}`, 'DELETE')}>Cancel job</button>}</li>)}</ul>
      {!data.jobs.length && <p>No prepared copies yet.</p>}
    </>}
    <button disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh status</button><p>After artwork is ready, refresh your library. Choose Compatible audio in the player once its job is ready.</p>
  </section>;
}
