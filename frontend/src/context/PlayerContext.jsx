import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { useAuth, API_BASE_URL } from './AuthContext';

const PlayerContext = createContext(null);

export const PlayerProvider = ({ children }) => {
  const { token, getAuthHeaders } = useAuth();
  
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [playlist, setPlaylist] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [analyser, setAnalyser] = useState(null);
  
  const audioRef = useRef(new Audio());
  const progressIntervalRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Initialize analyser node securely on first playback interaction
  const initAnalyser = () => {
    if (analyserRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 64; // Smaller fftSize for smooth visualizer waves

      // Enable CORS on audio
      audioRef.current.crossOrigin = "anonymous";

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyserNode);
      analyserNode.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyserNode;
      setAnalyser(analyserNode);
    } catch (e) {
      console.error('Failed to initialize AudioContext', e);
    }
  };

  // Parse timestamps like [MM:SS] Subtitle Text
  const parseSubtitles = (transcriptText) => {
    if (!transcriptText) return [];
    const lines = transcriptText.split('\n');
    const parsed = [];
    const regex = /\[(\d{2}):(\d{2})\](.*)/;

    lines.forEach(line => {
      const match = line.match(regex);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const time = minutes * 60 + seconds;
        const text = match[3].trim();
        parsed.push({ time, text });
      }
    });
    return parsed.sort((a, b) => a.time - b.time);
  };

  // Synchronize subtitles when currentEpisode changes
  useEffect(() => {
    if (currentEpisode && currentEpisode.transcript) {
      const parsed = parseSubtitles(currentEpisode.transcript);
      setSubtitles(parsed);
    } else {
      setSubtitles([]);
    }
  }, [currentEpisode]);

  // Compute active subtitle
  const activeSubtitleIndex = subtitles.findIndex((sub, idx) => {
    const nextSub = subtitles[idx + 1];
    if (nextSub) {
      return currentTime >= sub.time && currentTime < nextSub.time;
    }
    return currentTime >= sub.time;
  });
  const currentSubtitle = activeSubtitleIndex !== -1 ? subtitles[activeSubtitleIndex] : null;

  // Configure audio event listeners
  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const onEnded = () => {
      setIsPlaying(false);
      savePlaybackProgress(true); // Complete progress
      playNext();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [playlist, currentEpisode]);

  // Adjust volume
  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  // Adjust playback speed
  useEffect(() => {
    audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Handle audio device change (headphones unplugged -> pause)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      const handleDeviceChange = () => {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          savePlaybackProgress(false);
        }
      };
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [isPlaying]);

  // Save playback progress periodically (every 10 seconds)
  useEffect(() => {
    if (isPlaying && currentEpisode && token) {
      progressIntervalRef.current = setInterval(() => {
        savePlaybackProgress(false);
      }, 10000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, currentEpisode, currentTime, token]);

  const savePlaybackProgress = async (completed = false) => {
    if (!currentEpisode || !token) return;
    try {
      await fetch(`${API_BASE_URL}/episodes/${currentEpisode._id}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          position: currentTime,
          duration,
        }),
      });
    } catch (err) {
      console.error('Failed to save playback progress', err);
    }
  };

  const playEpisode = async (episode, newPlaylist = []) => {
    if (!episode) return;
    
    initAnalyser();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    
    // Increment playCount on the backend asynchronously
    fetch(`${API_BASE_URL}/episodes/${episode._id}/play`, {
      method: 'POST',
    }).catch(err => console.error('Failed to increment play count', err));

    // Track in listen history
    if (token) {
      fetch(`${API_BASE_URL}/episodes/${episode._id}/history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(err => console.error('Failed to add to listen history', err));
    }

    if (newPlaylist && newPlaylist.length > 0) {
      setPlaylist(newPlaylist);
    }

    const isSameEpisode = currentEpisode && currentEpisode._id === episode._id;
    
    if (!isSameEpisode) {
      let startPosition = 0;
      if (token) {
        try {
          const res = await fetch(`${API_BASE_URL}/episodes/${episode._id}/progress`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && data.progress && data.progress.position) {
            if (!data.progress.completed) {
              startPosition = data.progress.position;
            }
          }
        } catch (err) {
          console.error('Failed to fetch playback progress:', err);
        }
      }

      setCurrentEpisode(episode);
      audioRef.current.src = window.getMediaUrl(episode.audioUrl);
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.load();
      if (startPosition > 0) {
        audioRef.current.currentTime = startPosition;
        setCurrentTime(startPosition);
      }
    }

    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.error('Playback failed:', err));
  };

  const togglePlay = () => {
    if (!currentEpisode) return;

    initAnalyser();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      savePlaybackProgress(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('Playback restart failed:', err));
    }
  };

  const seek = (time) => {
    if (!currentEpisode) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
  };

  const changeVolume = (val) => {
    setVolume(val);
  };

  const playNext = () => {
    if (playlist.length === 0 || !currentEpisode) return;
    const currentIndex = playlist.findIndex((ep) => ep._id === currentEpisode._id);
    if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
      playEpisode(playlist[currentIndex + 1]);
    }
  };

  const playPrevious = () => {
    if (playlist.length === 0 || !currentEpisode) return;
    const currentIndex = playlist.findIndex((ep) => ep._id === currentEpisode._id);
    if (currentIndex > 0) {
      playEpisode(playlist[currentIndex - 1]);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentEpisode,
        isPlaying,
        currentTime,
        duration,
        playbackSpeed,
        volume,
        playlist,
        subtitles,
        currentSubtitle,
        analyser,
        playEpisode,
        togglePlay,
        seek,
        changeSpeed,
        changeVolume,
        playNext,
        playPrevious,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
