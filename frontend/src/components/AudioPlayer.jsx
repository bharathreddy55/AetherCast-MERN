import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { 
  Play, Pause, SkipForward, SkipBack, 
  Volume2, VolumeX, Gauge, Music, AlignLeft, Share2, Heart, Moon
} from 'lucide-react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import './AudioPlayer.css';
import AudioVisualizer from './AudioVisualizer';

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
  const [liked, setLiked] = useState(false);
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(null);
  const lyricsContainerRef = useRef(null);
  const { token, user } = useAuth();

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
    seek(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e) => {
    changeVolume(parseFloat(e.target.value));
  };

  const hasNext = playlist.findIndex((ep) => ep._id === currentEpisode._id) < playlist.length - 1;
  const hasPrevious = playlist.findIndex((ep) => ep._id === currentEpisode._id) > 0;

  return (
    <>
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
      <div className="audio-player glass-panel animate-fade-in">
        
        {/* Floating Mini Subtitle Bubble */}
        {currentSubtitle && !showLyrics && (
          <div className="player-subtitle-bubble">
            {currentSubtitle.text}
          </div>
        )}

        <div className="player-container">
          
          {/* Track Details */}
          <div className="player-track-info">
            {currentEpisode.podcastId?.coverImage ? (
              <img 
                src={`http://localhost:5000${currentEpisode.podcastId.coverImage}`} 
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
                onClick={togglePlay} 
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
                className="timeline-slider"
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

            {/* Sleep Timer */}
            <div className="speed-control" style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
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
            <div className="speed-control">
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

            {/* Volume Control */}
            <div className="volume-control">
              <button 
                onClick={() => changeVolume(volume === 0 ? 0.8 : 0)} 
                className="volume-icon-btn"
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>

            {/* Share & Like */}
            <button
              onClick={() => {
                const url = `${window.location.origin}/podcast/${currentEpisode.podcastId?._id}`;
                if (navigator.share) {
                  navigator.share({ title: currentEpisode.title, text: `Check out "${currentEpisode.title}" on AetherCast!`, url }).catch(() => {});
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

          </div>

        </div>
      </div>
    </>
  );
}
