import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { 
  Play, Pause, SkipForward, SkipBack, 
  Volume2, VolumeX, Gauge, Music, AlignLeft, Share2, Heart, Moon, Users,
  GripVertical, Maximize2, Minimize2, MessageSquare
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
  } = usePlayer();

  const [showLyrics, setShowLyrics] = useState(false);
  const [showListeningParty, setShowListeningParty] = useState(false);
  const [liked, setLiked] = useState(false);
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(null);
  const lyricsContainerRef = useRef(null);
  const isSyncingRef = useRef(false);
  const { token, user } = useAuth();

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

      {/* Synced Lyrics slide-up panel */}
      {showLyrics && subtitles.length > 0 && (
        <div className="lyrics-drawer glass-panel" ref={lyricsContainerRef}>
          <div className="lyrics-drawer-header">
            <h4>Live Synced Subtitles</h4>
            <button onClick={() => setShowLyrics(false)} className="close-lyrics-btn">×</button>
          </div>
          <div className="lyrics-drawer-body">
            {subtitles.map((sub, idx) => {
              const isActive = currentSubtitle && currentSubtitle.time === sub.time;
              return (
                <div 
                  key={idx} 
                  onClick={() => seek(sub.time)}
                  className={`lyric-line ${isActive ? 'active' : ''}`}
                >
                  <span className="lyric-time">{formatTime(sub.time)}</span>
                  <span className="lyric-text">{sub.text}</span>
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

        <div className="player-container">
          
          {/* Drag Handle */}
          <div className="player-drag-handle" title="Drag to float or reposition player">
            <GripVertical size={16} />
          </div>
          
          {/* Track Details */}
          <div className="player-track-info">
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

          </div>

        </div>
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
