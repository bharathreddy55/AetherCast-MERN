import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, MessageSquare, Radio } from 'lucide-react';
import { io } from 'socket.io-client';
import { supabase } from '../supabase';
import { BACKEND_URL } from '../lib/config';
import { createListeningPartyClient } from '../lib/listeningPartyClient';

export default function ListeningPartyDrawer({ episodeId, user, isPlaying, togglePlay, seek, onClose, isSyncingRef }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [syncPlayback, setSyncPlayback] = useState(true);
  const [status, setStatus] = useState({ connected: false, joined: false, error: '' });
  const [room, setRoom] = useState({ listenerCount: 0, isHost: false });
  const clientRef = useRef(null);
  const callbacksRef = useRef(null);
  const syncTimerRef = useRef(null);
  const chatEndRef = useRef(null);
  callbacksRef.current = { isPlaying, togglePlay, seek, syncPlayback, isSyncingRef };
  const ownerId = user?.id || user?._id;

  useEffect(() => {
    if (!ownerId) return;
    const syncState = isSyncingRef;
    setMessages([]);
    const client = createListeningPartyClient({
      makeSocket: io, backendUrl: BACKEND_URL, episodeId,
      getAccessToken: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session?.access_token;
      },
      onStatus: setStatus,
      onRoomState: setRoom,
      onMessage: message => setMessages(previous => [...previous.slice(-199), message]),
      onSync: (event, payload) => {
        const current = callbacksRef.current;
        if (!current.syncPlayback) return;
        clearTimeout(syncTimerRef.current);
        current.isSyncingRef.current = true;
        current.seek(payload.currentTime);
        if ((event === 'sync-play' && !current.isPlaying) || (event === 'sync-pause' && current.isPlaying)) current.togglePlay();
        syncTimerRef.current = setTimeout(() => { current.isSyncingRef.current = false; }, 400);
      },
    });
    clientRef.current = client;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) client.close();
      else if (event === 'TOKEN_REFRESHED') client.refreshSession();
    });
    const emitControl = (event, time) => {
      const current = callbacksRef.current;
      if (current.syncPlayback && !current.isSyncingRef.current) client.sendControl(event, time);
    };
    window.listeningPartySocketEmit = emitControl;
    return () => {
      subscription.unsubscribe();
      client.close();
      clientRef.current = null;
      clearTimeout(syncTimerRef.current);
      syncState.current = false;
      if (window.listeningPartySocketEmit === emitControl) delete window.listeningPartySocketEmit;
    };
  }, [episodeId, ownerId, isSyncingRef]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const sendMessage = event => {
    event.preventDefault();
    const draft = text;
    clientRef.current?.sendMessage(draft, () => setText(current => current === draft ? '' : current));
  };

  return (
    <div className="lyrics-drawer glass-panel" style={{ right: '20px', left: 'auto', width: 'min(380px, calc(100vw - 40px))', display: 'flex', flexDirection: 'column' }}>
      <div className="lyrics-drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={18} /><h4 style={{ margin: 0 }}>Private Listening Room</h4></div>
        <span style={{ fontSize: '0.75rem' }}>{status.joined ? room.listenerCount : 0} connected</span>
        <button onClick={onClose} className="close-lyrics-btn" aria-label="Close listening room">×</button>
      </div>
      {status.error && <div role="alert" style={{ padding: '10px', color: 'var(--text-secondary)' }}>{status.error}</div>}
      {!status.connected && <button className="btn-secondary" onClick={() => clientRef.current?.reconnect()}>Reconnect</button>}
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Only your signed-in devices can join. {room.isHost ? 'This device controls playback.' : 'Playback follows the host device.'}</p>
      {status.joined && !room.isHost && <button className="btn-secondary" onClick={() => clientRef.current?.claimHost()}>Take playback control</button>}
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
        <Radio size={14} /><span>Sync playback</span>
        <input type="checkbox" checked={syncPlayback} onChange={event => setSyncPlayback(event.target.checked)} />
      </label>
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '10px' }} aria-live="polite">
        {!messages.length && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}><MessageSquare size={24} />Messages appear after the server accepts them.</p>}
        {messages.map((message, index) => <div key={index} style={{ alignSelf: message.self ? 'flex-end' : 'flex-start', maxWidth: '85%', overflowWrap: 'anywhere', padding: '8px 12px', borderRadius: '12px', background: 'var(--bg-main)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{message.username}</span>
          <div style={{ fontSize: '0.85rem' }}>{message.message}</div>
        </div>)}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <input aria-label="Room message" type="text" maxLength={1000} disabled={!status.joined} placeholder="Message your connected devices..." value={text} onChange={event => setText(event.target.value)} className="form-input" style={{ flexGrow: 1, minWidth: 0 }} />
        <button type="submit" disabled={!status.joined || !text.trim()} className="btn-primary" aria-label="Send room message"><Send size={14} /></button>
      </form>
    </div>
  );
}
