import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Users, MessageSquare, Radio } from 'lucide-react';
import { io } from 'socket.io-client';

export default function ListeningPartyDrawer({ 
  episodeId, 
  user, 
  isPlaying, 
  currentTime, 
  togglePlay, 
  seek, 
  onClose,
  isSyncingRef // Shared ref from AudioPlayer to control loop prevention
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [syncPlayback, setSyncPlayback] = useState(true);
  const [listenerCount, setListenerCount] = useState(1);
  
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    // Connect to Socket.io backend
    const socketUrl = 'window.BACKEND_URL';
    const socket = io(socketUrl, {
      withCredentials: true
    });
    socketRef.current = socket;

    const roomId = episodeId;
    const username = user?.name || 'Guest Listener';
    const avatar = user?.avatar || '';

    // Join room
    socket.emit('join-room', { roomId, username });

    // Socket listeners
    socket.on('user-joined', ({ username }) => {
      setListenerCount(prev => prev + 1);
      setMessages(prev => [...prev, {
        system: true,
        text: `🎉 ${username} joined the listening party!`
      }]);
    });

    socket.on('user-left', ({ username }) => {
      setListenerCount(prev => Math.max(1, prev - 1));
      setMessages(prev => [...prev, {
        system: true,
        text: `👋 ${username} left the listening party.`
      }]);
    });

    socket.on('receive-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    // Playback sync listeners
    socket.on('sync-play', ({ username, currentTime: targetTime }) => {
      if (!syncPlayback) return;
      isSyncingRef.current = true;
      seek(targetTime);
      if (!isPlaying) togglePlay();
      setTimeout(() => { isSyncingRef.current = false; }, 400);
      setMessages(prev => [...prev, {
        system: true,
        text: `▶️ ${username} started playback at ${Math.round(targetTime)}s`
      }]);
    });

    socket.on('sync-pause', ({ username, currentTime: targetTime }) => {
      if (!syncPlayback) return;
      isSyncingRef.current = true;
      seek(targetTime);
      if (isPlaying) togglePlay();
      setTimeout(() => { isSyncingRef.current = false; }, 400);
      setMessages(prev => [...prev, {
        system: true,
        text: `⏸️ ${username} paused playback`
      }]);
    });

    socket.on('sync-seek', ({ username, currentTime: targetTime }) => {
      if (!syncPlayback) return;
      isSyncingRef.current = true;
      seek(targetTime);
      setTimeout(() => { isSyncingRef.current = false; }, 400);
      setMessages(prev => [...prev, {
        system: true,
        text: `🔍 ${username} skipped to ${Math.round(targetTime)}s`
      }]);
    });

    return () => {
      socket.emit('leave-room', { roomId, username });
      socket.disconnect();
    };
  }, [episodeId, syncPlayback]);

  // Handle local playback events to emit to others
  useEffect(() => {
    if (!socketRef.current || !syncPlayback || isSyncingRef.current) return;
    
    // We emit only when the change is local
    // To distinguish seek/time changes, we can track state changes, but since this useEffect
    // is simple, we will coordinate manual action clicks from AudioPlayer.jsx instead.
  }, [isPlaying]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !socketRef.current) return;

    const username = user?.name || 'Guest Listener';
    const avatar = user?.avatar || '';
    const roomId = episodeId;

    const msgObj = {
      roomId,
      username,
      message: text.trim(),
      avatar
    };

    // Emit to other room members
    socketRef.current.emit('send-message', msgObj);

    // Add to local list instantly
    setMessages(prev => [...prev, {
      username,
      message: text.trim(),
      avatar,
      timestamp: new Date().toISOString(),
      self: true
    }]);

    setText('');
  };

  // Expose emit wrappers so parent AudioPlayer can trigger syncs on click
  useEffect(() => {
    if (socketRef.current) {
      window.listeningPartySocketEmit = (event, time) => {
        if (!syncPlayback || isSyncingRef.current) return;
        const roomId = episodeId;
        const username = user?.name || 'Guest Listener';
        socketRef.current.emit(event, { roomId, username, currentTime: time });
      };
    }
    return () => {
      delete window.listeningPartySocketEmit;
    };
  }, [episodeId, syncPlayback]);

  return (
    <div className="lyrics-drawer glass-panel" style={{ right: '20px', left: 'auto', width: '380px', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="lyrics-drawer-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} style={{ color: 'var(--color-primary-hover)' }} />
          <h4 style={{ margin: 0 }}>Listening Party</h4>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '10px' }}>
            ● {listenerCount} active
          </span>
          <button onClick={onClose} className="close-lyrics-btn" style={{ fontSize: '1.25rem' }}>×</button>
        </div>
      </div>

      {/* Sync Toggle */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '10px 14px', 
        background: 'rgba(255,255,255,0.02)', 
        borderRadius: '8px', 
        margin: '10px 0', 
        border: '1px solid rgba(255,255,255,0.04)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Radio size={14} style={{ color: syncPlayback ? '#06b6d4' : 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.8rem', color: '#fff' }}>Sync Audio Playback</span>
        </div>
        <input 
          type="checkbox" 
          checked={syncPlayback} 
          onChange={(e) => setSyncPlayback(e.target.checked)}
          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
        />
      </div>

      {/* Chat Messages */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <MessageSquare size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            Listening Party started.<br />Send a message to chat!
          </div>
        ) : (
          messages.map((m, idx) => {
            if (m.system) {
              return (
                <div key={idx} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>
                  {m.text}
                </div>
              );
            }

            return (
              <div key={idx} style={{ 
                alignSelf: m.self ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                display: 'flex',
                gap: '8px',
                flexDirection: m.self ? 'row-reverse' : 'row'
              }}>
                {!m.self && (
                  m.avatar ? (
                    <img src={`window.BACKEND_URL${m.avatar}`} alt="Av" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--grad-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      {m.username.charAt(0).toUpperCase()}
                    </div>
                  )
                )}
                <div>
                  {!m.self && <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px', textAlign: 'left' }}>{m.username}</span>}
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '12px',
                    background: m.self ? 'var(--color-primary-hover)' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    textAlign: 'left'
                  }}>
                    {m.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <input
          type="text"
          placeholder="Say something to the room..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            flexGrow: 1,
            height: '36px',
            padding: '0 12px',
            borderRadius: '18px',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: '0.85rem'
          }}
        />
        <button type="submit" className="comment-send-btn" style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-hover)', color: '#fff', border: 0, cursor: 'pointer' }}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
