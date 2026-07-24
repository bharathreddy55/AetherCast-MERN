import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { 
  Play, Pause, SkipForward, SkipBack, 
  Volume2, VolumeX, Gauge, Music, AlignLeft, Share2, Heart, Moon, Users,
  GripVertical, Maximize2, Minimize2, MessageSquare, ChevronDown, ChevronUp, X,
  Sliders, Bookmark, Trash2, Download
} from 'lucide-react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import './AudioPlayer.css';
import AudioVisualizer from './AudioVisualizer';
import ListeningPartyDrawer from './ListeningPartyDrawer';

export default function AudioPlayer() {
  const {
    currentEpisode,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    volume,
    playlist,
    subtitles,
    currentSubtitle,
    togglePlay,
    seek,
    changeSpeed,
    changeVolume,
    playNext,
    playPrevious,
    closePlayer,
    audioRef,
    isAuthorized,
    eqGains,
    eqPreset,
    changeEqualizer,
    applyPreset,
    playEpisode,
  } = usePlayer();

  const [showLyrics, setShowLyrics] = useState(false);
  const [showListeningParty, setShowListeningParty] = useState(false);
  const [liked, setLiked] = useState(false);
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(null);
  const lyricsContainerRef = useRef(null);
  const isSyncingRef = useRef(false);
  const { token, user } = useAuth();
  
  // New Enhanced States
  const [transcriptSearchQuery, setTranscriptSearchQuery] = useState('');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [newBookmarkNote, setNewBookmarkNote] = useState('');
  const [showEqPanel, setShowEqPanel] = useState(false);
  const videoContainerRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // AI Chat States
  const [showAiChat, setShowAiChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'ai', text: 'Hi! Ask me anything about this episode\'s content.' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    setChatHistory([
      { sender: 'ai', text: 'Hi! Ask me anything about this episode\'s content.' }
    ]);
    setShowAiChat(false);
  }, [currentEpisode]);

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = chatMessage.trim();
    setChatMessage('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/episodes/${currentEpisode._id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg })
      });
      const data = await res.json();
      if (data.success && data.answer) {
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.answer }]);
      } else {
        setChatHistory(prev => [...prev, { sender: 'ai', text: 'Sorry, I failed to process your question. Please try again.' }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { sender: 'ai', text: 'Error connecting to AI service.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Floating & Dragging states
  const [isFloating, setIsFloating] = useState(false);
  const [dragPos, setDragPos] = useState({ x: window.innerWidth - 360, y: window.innerHeight - 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const playerPosStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    // Only drag on handle or background, don't drag if clicking buttons/selectors/inputs
    if (e.target.closest('button, input, select, a, .lyrics-drawer')) return;
    
    setIsDragging(true);
    const playerEl = e.currentTarget;
    const rect = playerEl.getBoundingClientRect();
    
    // Set starting position based on current element coords
    const currentX = isFloating ? dragPos.x : rect.left;
    const currentY = isFloating ? dragPos.y : rect.top;
    
    setDragPos({ x: currentX, y: currentY });
    setIsFloating(true); // Detach immediately on drag

    dragStart.current = { x: e.clientX, y: e.clientY };
    playerPosStart.current = { x: currentX, y: currentY };
    
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      let newX = playerPosStart.current.x + dx;
      let newY = playerPosStart.current.y + dy;

      // Bound to screen window limits
      const width = 340;
      const height = 300;
      newX = Math.max(10, Math.min(window.innerWidth - width - 10, newX));
      newY = Math.max(10, Math.min(window.innerHeight - height - 10, newY));

      setDragPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handle docking when dragging near bottom
  useEffect(() => {
    if (isDragging) return;
    if (isFloating) {
      // Dock if dropped close to bottom of page (within 80px)
      const distanceToBottom = window.innerHeight - (dragPos.y + 110);
      if (distanceToBottom < 80) {
        setIsFloating(false);
      }
    }
  }, [isDragging, isFloating, dragPos.y]);

  // Adjust coordinates if window resizes
  useEffect(() => {
    const handleResize = () => {
      if (isFloating) {
        setDragPos(prev => ({
          x: Math.max(10, Math.min(window.innerWidth - 360, prev.x)),
          y: Math.max(10, Math.min(window.innerHeight - 300, prev.y))
        }));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFloating]);

  // Sleep Timer logic
  useEffect(() => {
    if (sleepTimeRemaining === null) return;
    if (sleepTimeRemaining <= 0) {
      if (isPlaying) togglePlay();
      setSleepTimeRemaining(null);
      return;
    }

    const timer = setTimeout(() => {
      setSleepTimeRemaining(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [sleepTimeRemaining, isPlaying]);

  // Keyboard Shortcuts logic
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(duration, currentTime + 10));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, currentTime - 10));
          break;
        case 'KeyM':
          e.preventDefault();
          changeVolume(volume === 0 ? 0.8 : 0);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration, volume]);

  // Sync liked state when currentEpisode or user changes
  useEffect(() => {
    if (currentEpisode && user) {
      const isLiked = currentEpisode.likedBy && currentEpisode.likedBy.includes(user._id);
      setLiked(!!isLiked);
    } else {
      setLiked(false);
    }
  }, [currentEpisode, user]);

  // Auto-scroll the active subtitle line into the center of the list
  useEffect(() => {
    if (showLyrics && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.querySelector('.lyric-line.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentSubtitle, showLyrics]);

  // 1. Fetch bookmarks for current episode
  const fetchBookmarks = async () => {
    if (!token || !currentEpisode) return;
    try {
      const res = await fetch(`${API_BASE_URL}/bookmarks/episode/${currentEpisode._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBookmarks(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch bookmarks', err);
    }
  };

  useEffect(() => {
    if (showBookmarks) {
      fetchBookmarks();
    }
  }, [showBookmarks, currentEpisode]);

  // 2. Bookmark form submit handler
  const handleAddBookmark = async (e) => {
    e.preventDefault();
    if (!newBookmarkNote.trim() || !token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          episodeId: currentEpisode._id,
          timestamp: currentTime,
          note: newBookmarkNote
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewBookmarkNote('');
        fetchBookmarks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Delete bookmark handler
  const handleDeleteBookmark = async (bookmarkId) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/bookmarks/${bookmarkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchBookmarks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 4. simulated Stripe checkout for premium episodes
  const handleBuyEpisode = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ episodeId: currentEpisode._id })
      });
      const data = await res.json();
      if (data.success) {
        // Re-load the episode to trigger the verification check and retrieve auth
        playEpisode(currentEpisode);
      }
    } catch (err) {
      console.error('Simulated checkout failed:', err);
    }
  };

  // 5. Mount video element if episode is video
  useEffect(() => {
    if (videoContainerRef.current && currentEpisode?.mediaType === 'video' && audioRef.current) {
      videoContainerRef.current.appendChild(audioRef.current);
      audioRef.current.style.width = '100%';
      audioRef.current.style.height = '100%';
      audioRef.current.style.objectFit = 'contain';
      
      // Ensure visual controls for native HTML video element are hidden since we build custom UI
      audioRef.current.controls = false;
      
      return () => {
        if (videoContainerRef.current && videoContainerRef.current.contains(audioRef.current)) {
          videoContainerRef.current.removeChild(audioRef.current);
        }
      };
    }
  }, [currentEpisode, isCollapsed, showLyrics, showListeningParty, showAiChat, showBookmarks, isAuthorized]);

  // 6. Check if episode is downloaded in Service Worker Cache
  const checkIsDownloaded = async () => {
    if (!currentEpisode) return;
    try {
      const cache = await caches.open('vox-audio-v1');
      const mediaUrl = window.getMediaUrl(currentEpisode.audioUrl);
      const match = await cache.match(mediaUrl, { ignoreSearch: true });
      setDownloaded(!!match);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkIsDownloaded();
  }, [currentEpisode]);

  const handleDownload = async () => {
    if (!currentEpisode) return;
    setDownloading(true);
    const mediaUrl = window.getMediaUrl(currentEpisode.audioUrl);
    try {
      const cache = await caches.open('vox-audio-v1');
      const response = await fetch(mediaUrl);
      if (response.status === 200) {
        await cache.put(mediaUrl, response);
        setDownloaded(true);
      } else {
        alert('Failed to download: Server returned ' + response.status);
      }
    } catch (err) {
      console.error('Failed to cache for offline:', err);
      alert('Failed to save for offline usage.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRemoveDownload = async () => {
    if (!currentEpisode) return;
    const mediaUrl = window.getMediaUrl(currentEpisode.audioUrl);
    try {
      const cache = await caches.open('vox-audio-v1');
      await cache.delete(mediaUrl, { ignoreSearch: true });
      setDownloaded(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentEpisode) return null;

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeekChange = (e) => {
    const targetTime = parseFloat(e.target.value);
    seek(targetTime);
    if (window.listeningPartySocketEmit) {
      window.listeningPartySocketEmit('sync-seek', targetTime);
    }
  };

  const handlePlayClick = () => {
    if (window.listeningPartySocketEmit) {
      window.listeningPartySocketEmit(isPlaying ? 'sync-pause' : 'sync-play', currentTime);
    }
    togglePlay();
  };

  const handleVolumeChange = (e) => {
    changeVolume(parseFloat(e.target.value));
  };

  const hasNext = playlist.findIndex((ep) => ep._id === currentEpisode._id) < playlist.length - 1;
  const hasPrevious = playlist.findIndex((ep) => ep._id === currentEpisode._id) > 0;

  const percentage = duration ? (currentTime / duration) * 100 : 0;

  if (isCollapsed) {
    return (
      <div 
        className="audio-player-collapsed glass-panel animate-scale-up"
        onClick={() => setIsCollapsed(false)}
        title="Click to expand audio player"
        style={isFloating ? {
          position: 'fixed',
          left: `${dragPos.x}px`,
          top: `${dragPos.y}px`,
          bottom: 'auto',
          right: 'auto',
          transform: 'none',
        } : {}}
      >
        {currentEpisode.podcastId?.coverImage ? (
          <img 
            src={window.getMediaUrl(currentEpisode.podcastId.coverImage)} 
            alt="Cover" 
            className={`player-collapsed-cover ${isPlaying ? 'spinning' : ''}`} 
          />
        ) : (
          <div className="player-collapsed-placeholder">
            <Music size={16} />
          </div>
        )}
        <div className="player-collapsed-info">
          <p className="player-collapsed-title">{currentEpisode.title}</p>
          <span className="player-collapsed-status">
            {isPlaying ? 'Playing' : 'Paused'}
          </span>
        </div>
        <div className="player-collapsed-controls" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={handlePlayClick} 
            className="player-collapsed-play-btn"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: '1px' }} />}
          </button>
          <button 
            onClick={() => setIsCollapsed(false)} 
            className="player-collapsed-expand-btn"
            title="Expand Player"
          >
            <ChevronUp size={16} />
          </button>
          <button 
            onClick={closePlayer} 
            className="player-collapsed-close-btn"
            title="Close Player"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* AI Episode Copilot Chat slide-up panel */}
      {showAiChat && (
        <div className="lyrics-drawer glass-panel animate-scale-up" style={{ display: 'flex', flexDirection: 'column', height: '350px', zIndex: 100 }}>
          <div className="lyrics-drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontSize: '0.95rem' }}>
              <MessageSquare size={16} style={{ color: 'var(--color-primary)' }} />
              AI Episode Copilot
            </h4>
            <button onClick={() => setShowAiChat(false)} className="close-lyrics-btn" style={{ background: 'none', border: 0, color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chatHistory.map((msg, idx) => (
              <div 
                key={idx} 
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.sender === 'user' ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                  color: 'var(--text-primary)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  maxWidth: '80%',
                  fontSize: '0.8rem',
                  lineHeight: '1.4',
                  boxShadow: msg.sender === 'user' ? '0 2px 8px rgba(255,122,0,0.2)' : 'none'
                }}
              >
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                AI is thinking...
              </div>
            )}
          </div>
          <form onSubmit={handleSendChatMessage} style={{ borderTop: '1px solid var(--border-color)', padding: '10px 16px', display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
            <input
              type="text"
              placeholder="Ask about this episode..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              style={{
                flex: 1,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '50px',
                padding: '8px 16px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            <button 
              type="submit" 
              disabled={chatLoading} 
              className="btn-primary" 
              style={{ padding: '8px 16px', borderRadius: '50px', fontSize: '0.85rem', height: '36px' }}
            >
              Ask
            </button>
          </form>
        </div>
      )}

      {/* Smart Bookmarks / Notes Drawer */}
      {showBookmarks && token && (
        <div className="lyrics-drawer glass-panel animate-scale-up" style={{ display: 'flex', flexDirection: 'column', height: '350px', zIndex: 100 }}>
          <div className="lyrics-drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontSize: '0.95rem' }}>
              <Bookmark size={16} style={{ color: 'var(--color-primary)' }} />
              Timestamp Bookmarks & Notes
            </h4>
            <button onClick={() => setShowBookmarks(false)} className="close-lyrics-btn" style={{ background: 'none', border: 0, color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bookmarks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '20px' }}>No bookmarks saved for this episode. Add one below!</p>
            ) : (
              bookmarks.map((bm) => (
                <div 
                  key={bm._id} 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div 
                    onClick={() => seek(bm.timestamp)} 
                    style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}
                  >
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: '600' }}>
                      {formatTime(bm.timestamp)}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {bm.note}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleDeleteBookmark(bm._id)}
                    style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    title="Delete Bookmark"
                  >
                    <Trash2 size={14} onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'} />
                  </button>
                </div>
              ))
            )}
          </div>
          
          <form onSubmit={handleAddBookmark} style={{ borderTop: '1px solid var(--border-color)', padding: '10px 16px', display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', alignSelf: 'center', fontWeight: '600' }}>
              {formatTime(currentTime)}
            </span>
            <input
              type="text"
              placeholder="Add note at this timestamp..."
              value={newBookmarkNote}
              onChange={(e) => setNewBookmarkNote(e.target.value)}
              style={{
                flex: 1,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '50px',
                padding: '8px 16px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ padding: '8px 16px', borderRadius: '50px', fontSize: '0.85rem', height: '36px' }}
            >
              Add
            </button>
          </form>
        </div>
      )}

      {/* Equalizer Control Panel */}
      {showEqPanel && (
        <div 
          className="glass-panel animate-scale-up" 
          style={{
            position: 'fixed',
            bottom: isFloating ? 'auto' : '110px',
            right: isFloating ? 'auto' : '150px',
            left: isFloating ? `${dragPos.x}px` : 'auto',
            top: isFloating ? `${dragPos.y - 195}px` : 'auto',
            width: '220px',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--glass-shadow)',
            zIndex: 102,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={14} style={{ color: 'var(--color-primary)' }} />
              Audio Equalizer
            </h4>
            <button onClick={() => setShowEqPanel(false)} style={{ background: 'none', border: 0, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PRESETS</label>
            <select 
              value={eqPreset} 
              onChange={(e) => applyPreset(e.target.value)}
              style={{
                width: '100%',
                padding: '6px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="flat">Flat (Default)</option>
              <option value="bass-boost">Bass Boost</option>
              <option value="voice-clarity">Voice Clarity</option>
              <option value="classic-podcast">Classic Podcast</option>
              <option value="music">Music Boost</option>
              <option value="custom" disabled>Custom</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                <span>Bass (Low)</span>
                <span>{eqGains.low > 0 ? `+${eqGains.low}` : eqGains.low} dB</span>
              </div>
              <input 
                type="range"
                min="-10"
                max="10"
                step="1"
                value={eqGains.low}
                onChange={(e) => changeEqualizer('low', parseFloat(e.target.value))}
                style={{ width: '100%', height: '4px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                <span>Vocal (Mid)</span>
                <span>{eqGains.mid > 0 ? `+${eqGains.mid}` : eqGains.mid} dB</span>
              </div>
              <input 
                type="range"
                min="-10"
                max="10"
                step="1"
                value={eqGains.mid}
                onChange={(e) => changeEqualizer('mid', parseFloat(e.target.value))}
                style={{ width: '100%', height: '4px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                <span>Treble (High)</span>
                <span>{eqGains.high > 0 ? `+${eqGains.high}` : eqGains.high} dB</span>
              </div>
              <input 
                type="range"
                min="-10"
                max="10"
                step="1"
                value={eqGains.high}
                onChange={(e) => changeEqualizer('high', parseFloat(e.target.value))}
                style={{ width: '100%', height: '4px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Synced Lyrics slide-up panel */}
      {showLyrics && subtitles.length > 0 && (
        <div className="lyrics-drawer glass-panel" ref={lyricsContainerRef} style={{ zIndex: 101 }}>
          <div className="lyrics-drawer-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>Live Synced Subtitles</h4>
              <button onClick={() => setShowLyrics(false)} className="close-lyrics-btn">×</button>
            </div>
            <input 
              type="text"
              placeholder="Search transcript..."
              value={transcriptSearchQuery}
              onChange={(e) => setTranscriptSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>
          <div className="lyrics-drawer-body">
            {subtitles
              .filter(sub => sub.text.toLowerCase().includes(transcriptSearchQuery.toLowerCase()))
              .map((sub, idx) => {
                const isActive = currentSubtitle && currentSubtitle.time === sub.time;
                const highlightText = (text, query) => {
                  if (!query) return text;
                  const parts = text.split(new RegExp(`(${query})`, 'gi'));
                  return parts.map((part, index) => 
                    part.toLowerCase() === query.toLowerCase() 
                      ? <mark key={index} style={{ backgroundColor: 'var(--color-primary)', color: '#fff', borderRadius: '2px', padding: '0 2px' }}>{part}</mark> 
                      : part
                  );
                };
                return (
                  <div 
                    key={idx} 
                    onClick={() => seek(sub.time)}
                    className={`lyric-line ${isActive ? 'active' : ''}`}
                  >
                    <span className="lyric-time">{formatTime(sub.time)}</span>
                    <span className="lyric-text">{highlightText(sub.text, transcriptSearchQuery)}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Main player bar */}
      <div 
        className={`audio-player glass-panel animate-fade-in ${isFloating ? 'player-floating' : ''} ${isDragging ? 'player-dragging' : ''}`}
        onMouseDown={handleMouseDown}
        style={isFloating ? {
          left: `${dragPos.x}px`,
          top: `${dragPos.y}px`,
          bottom: 'auto',
          right: 'auto',
          transform: 'none',
        } : {}}
      >
        
        {/* Floating Mini Subtitle Bubble */}
        {currentSubtitle && !showLyrics && (
          <div className="player-subtitle-bubble">
            {currentSubtitle.text}
          </div>
        )}

        {!isAuthorized ? (
          /* Premium Paywall Screen */
          <div className="player-paywall-container" style={{ display: 'flex', flexDirection: isFloating ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: '16px', width: '100%', padding: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: isFloating ? 'center' : 'left', flexDirection: isFloating ? 'column' : 'row', minWidth: 0, flex: 1 }}>
              {currentEpisode.podcastId?.coverImage ? (
                <img 
                  src={window.getMediaUrl(currentEpisode.podcastId.coverImage)} 
                  alt="Cover" 
                  className="player-cover-art" 
                />
              ) : (
                <div className="player-cover-placeholder">
                  <Music size={20} />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <p className="player-track-title" style={{ fontSize: '0.85rem' }}>🔒 Premium: {currentEpisode.title}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Unlock this episode to listen</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', width: isFloating ? '100%' : 'auto', justifyContent: 'center' }}>
              <button 
                onClick={handleBuyEpisode}
                className="btn-primary" 
                style={{ padding: '8px 16px', borderRadius: '50px', fontSize: '0.8rem', height: '32px', whiteSpace: 'nowrap' }}
              >
                Buy for ${currentEpisode.price || '1.99'}
              </button>
              <button 
                onClick={closePlayer}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '50px', fontSize: '0.8rem', cursor: 'pointer', height: '32px' }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="player-container">
            
            {/* Drag Handle */}
            <div className="player-drag-handle" title="Drag to float or reposition player">
              <GripVertical size={16} />
            </div>
          
          {/* Track Details */}
          <div className="player-track-info">
            {currentEpisode.mediaType === 'video' ? (
              <div 
                ref={videoContainerRef} 
                className="player-video-container"
                style={{
                  width: isFloating ? '100%' : '80px',
                  height: isFloating ? '100px' : '56px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#000',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              />
            ) : currentEpisode.podcastId?.coverImage ? (
              <img 
                src={window.getMediaUrl(currentEpisode.podcastId.coverImage)} 
                alt="Cover" 
                className="player-cover-art" 
              />
            ) : (
              <div className="player-cover-placeholder">
                <Music size={20} />
              </div>
            )}
            <div className="player-track-metadata">
              <p className="player-track-title">{currentEpisode.title}</p>
              <p className="player-track-podcast">{currentEpisode.podcastId?.title || 'Single Episode'}</p>
            </div>
            <div className="player-visualizer-container" style={{ marginLeft: '12px' }}>
              <AudioVisualizer />
            </div>
          </div>

          {/* Playback Controls & Progress Bar */}
          <div className="player-controls-section">
            <div className="player-buttons">
              <button 
                onClick={playPrevious} 
                disabled={!hasPrevious} 
                className="control-btn"
                title="Previous Episode"
              >
                <SkipBack size={20} />
              </button>
              <button 
                onClick={handlePlayClick} 
                className="play-pause-btn"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" style={{ marginLeft: '2px' }} />}
              </button>
              <button 
                onClick={playNext} 
                disabled={!hasNext} 
                className="control-btn"
                title="Next Episode"
              >
                <SkipForward size={20} />
              </button>
            </div>

            <div className="player-timeline">
              <span className="time-text">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeekChange}
                className={`timeline-slider ${isPlaying ? 'playing-track' : ''}`}
                style={{
                  background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%, rgba(255, 255, 255, 0.1) 100%)`
                }}
              />
              <span className="time-text">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Auxiliary Controls (Volume, Speed, Subtitles) */}
          <div className="player-aux-section">
            {/* Synced Lyrics Toggle Button */}
            {subtitles.length > 0 && (
              <button 
                onClick={() => setShowLyrics(!showLyrics)} 
                className="volume-icon-btn"
                style={{ color: showLyrics ? 'var(--color-primary-hover)' : 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 0, padding: '4px' }}
                title="Toggle Live Synced Subtitles"
              >
                <AlignLeft size={18} />
              </button>
            )}

            {/* Listening Party Button */}
            {token && (
              <button 
                onClick={() => {
                  setShowListeningParty(!showListeningParty);
                  setShowLyrics(false);
                  setShowAiChat(false);
                }} 
                className="volume-icon-btn"
                style={{ color: showListeningParty ? 'var(--color-primary-hover)' : 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 0, padding: '4px', marginRight: '8px' }}
                title="Join Listening Party"
              >
                <Users size={18} />
              </button>
            )}

            {/* AI Copilot Chat Button */}
            {token && (
              <button 
                onClick={() => {
                  setShowAiChat(!showAiChat);
                  setShowListeningParty(false);
                  setShowLyrics(false);
                }} 
                className="volume-icon-btn"
                style={{ color: showAiChat ? 'var(--color-primary-hover)' : 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 0, padding: '4px', marginRight: '8px' }}
                title="AI Episode Copilot Chat"
              >
                <MessageSquare size={18} />
              </button>
            )}

            {/* Equalizer Toggle Button */}
            <button 
              onClick={() => {
                setShowEqPanel(!showEqPanel);
                setShowLyrics(false);
                setShowListeningParty(false);
                setShowAiChat(false);
                setShowBookmarks(false);
              }} 
              className="volume-icon-btn"
              style={{ color: showEqPanel ? 'var(--color-primary-hover)' : 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 0, padding: '4px', marginRight: '8px' }}
              title="Audio Equalizer"
            >
              <Sliders size={18} />
            </button>

            {/* Smart Bookmarks Toggle Button */}
            {token && (
              <button 
                onClick={() => {
                  setShowBookmarks(!showBookmarks);
                  setShowLyrics(false);
                  setShowListeningParty(false);
                  setShowAiChat(false);
                  setShowEqPanel(false);
                }} 
                className="volume-icon-btn"
                style={{ color: showBookmarks ? 'var(--color-primary-hover)' : 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 0, padding: '4px', marginRight: '8px' }}
                title="Episode Bookmarks & Notes"
              >
                <Bookmark size={18} />
              </button>
            )}

            {/* Download/Offline Toggle Button */}
            {token && (
              <button 
                onClick={downloaded ? handleRemoveDownload : handleDownload} 
                disabled={downloading}
                className="volume-icon-btn"
                style={{ 
                  color: downloaded ? '#10b981' : (downloading ? 'var(--color-primary)' : 'var(--text-secondary)'), 
                  cursor: 'pointer', 
                  background: 'none', 
                  border: 0, 
                  padding: '4px', 
                  marginRight: '8px'
                }}
                title={downloaded ? "Remove Downloaded Episode" : (downloading ? "Downloading..." : "Download Episode for Offline")}
              >
                <Download size={18} style={{ animation: downloading ? 'spin 1.5s linear infinite' : 'none' }} />
              </button>
            )}

            {/* Sleep Timer */}
            <div className="speed-control sleep-timer-control" style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
              <Moon size={16} className="aux-icon" style={{ color: sleepTimeRemaining !== null ? '#a855f7' : 'var(--text-secondary)' }} />
              <select
                value={sleepTimeRemaining === null ? 'off' : sleepTimeRemaining}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'off') {
                    setSleepTimeRemaining(null);
                  } else {
                    setSleepTimeRemaining(parseInt(val, 10));
                  }
                }}
                className="speed-dropdown"
                title="Sleep Timer"
              >
                <option value="off">Off</option>
                <option value="900">15 min</option>
                <option value="1800">30 min</option>
                <option value="2700">45 min</option>
                <option value="3600">1 hour</option>
              </select>
              {sleepTimeRemaining !== null && (
                <span style={{ fontSize: '0.65rem', color: '#a855f7', marginLeft: '4px' }}>
                  {Math.ceil(sleepTimeRemaining / 60)}m
                </span>
              )}
            </div>

            {/* Speed Selector */}
            <div className="speed-control speed-selector-control">
              <Gauge size={16} className="aux-icon" />
              <select
                value={playbackSpeed}
                onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                className="speed-dropdown"
              >
                <option value="0.5">0.5x</option>
                <option value="1">1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>
            </div>

            {/* Volume Control (Vertical Hover Popover) */}
            <div className="volume-control-container">
              <div className="volume-slider-popover">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="volume-slider-vertical"
                  style={{
                    background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${volume * 100}%, rgba(255, 255, 255, 0.1) ${volume * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                  }}
                />
              </div>
              <button 
                onClick={() => changeVolume(volume === 0 ? 0.8 : 0)} 
                className="volume-icon-btn"
                style={{ background: 'none', border: 0, padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Volume"
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>

            {/* Share & Like */}
            <button
              onClick={() => {
                const url = `${window.location.origin}/podcast/${currentEpisode.podcastId?._id}`;
                if (navigator.share) {
                  navigator.share({ title: currentEpisode.title, text: `Check out "${currentEpisode.title}" on VOX!`, url }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(url);
                }
              }}
              className="volume-icon-btn"
              style={{ background: 'none', border: 0, padding: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              title="Share Episode"
            >
              <Share2 size={18} />
            </button>
            {token && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE_URL}/episodes/${currentEpisode._id}/like`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    if (data.success) setLiked(data.liked);
                  } catch (err) { console.error(err); }
                }}
                className="volume-icon-btn"
                style={{ background: 'none', border: 0, padding: '4px', cursor: 'pointer', color: liked ? '#ef4444' : 'var(--text-secondary)' }}
                title={liked ? 'Unlike' : 'Like'}
              >
                <Heart size={18} fill={liked ? '#ef4444' : 'none'} />
              </button>
            )}
            {/* Float / Dock Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isFloating) {
                  setIsFloating(false);
                } else {
                  // Position near bottom-right default
                  setDragPos({
                    x: window.innerWidth - 360,
                    y: window.innerHeight - 320
                  });
                  setIsFloating(true);
                }
              }}
              className="volume-icon-btn"
              style={{ background: 'none', border: 0, padding: '4px', cursor: 'pointer', color: isFloating ? 'var(--color-primary)' : 'var(--text-secondary)' }}
              title={isFloating ? "Dock Player to Bottom" : "Float Player"}
            >
              {isFloating ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            {/* Collapse Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(true);
              }}
              className="volume-icon-btn"
              style={{ background: 'none', border: 0, padding: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              title="Collapse Player"
            >
              <ChevronDown size={18} />
            </button>

            {/* Close/Stop Player Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closePlayer();
              }}
              className="volume-icon-btn"
              style={{ background: 'none', border: 0, padding: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              title="Close Player"
            >
              <X size={18} />
            </button>

          </div>

        </div>
        )}
      </div>

      {/* Listening Party slide-up panel */}
      {showListeningParty && token && (
        <ListeningPartyDrawer
          episodeId={currentEpisode._id}
          user={user}
          isPlaying={isPlaying}
          currentTime={currentTime}
          togglePlay={togglePlay}
          seek={seek}
          isSyncingRef={isSyncingRef}
          onClose={() => setShowListeningParty(false)}
        />
      )}
    </>
  );
}
