import { apiFetch } from '../lib/apiClient';
import React, { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useAuth, API_BASE_URL } from './AuthContext';
import { readDownload } from '../lib/downloads';
import { resolveEpisodeMedia } from '../lib/resolveEpisodeMedia';
import { createProgressTracker, createProgressSender } from '../lib/playbackProgress';

const PlayerContext = createContext(null);

export const PlayerProvider = ({ children }) => {
  const { token, user, loading: authLoading } = useAuth();
  
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [playlist, setPlaylist] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [analyser, setAnalyser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [playbackError, setPlaybackError] = useState('');
  const [eqGains, setEqGains] = useState({ low: 0, mid: 0, high: 0 });
  const [eqPreset, setEqPreset] = useState('flat');
  
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = document.createElement('video');
  const playRequestRef = useRef(0);
  const blobUrlRef = useRef(null);
  const mediaLoadedAtRef = useRef(0);
  const activeMediaRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const commandsRef = useRef({});
  const authRef = useRef(null);
  authRef.current = { token, ownerId: user?.id || user?._id };
  const progressTrackerRef = useRef(null);
  if (!progressTrackerRef.current) progressTrackerRef.current = createProgressTracker({
    getSnapshot: () => {
      const media = activeMediaRef.current;
      const auth = authRef.current;
      if (!media?.ready || media.ownerId !== auth?.ownerId) return null;
      return { ...auth, episodeId: media.episode._id, position: audioRef.current.currentTime, duration: audioRef.current.duration };
    },
    send: createProgressSender(API_BASE_URL),
    onError: () => console.warn('Playback progress could not be saved. Listening can continue.'),
  });
  const progressTracker = progressTrackerRef.current;
  const savePlaybackProgress = useCallback((completed = false, options = {}) => progressTracker.save({ ...options, completed }), [progressTracker]);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);

  const lowFilterRef = useRef(null);
  const midFilterRef = useRef(null);
  const highFilterRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      void progressTracker.stop({ keepalive: true });
      ++playRequestRef.current;
      audio.pause();
      activeMediaRef.current = null;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    };
  }, [progressTracker]);

  useEffect(() => {
    if (authLoading || user) return;
    void progressTracker.stop({ save: false });
    progressTracker.clear();
    ++playRequestRef.current;
    activeMediaRef.current = null;
    pendingSeekRef.current = null;
    audioRef.current.pause();
    audioRef.current.removeAttribute('src');
    audioRef.current.load();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
    setIsPlaying(false);
    setCurrentEpisode(null);
    setPlaylist([]);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError('');
  }, [user, authLoading, progressTracker]);
  
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

      // Create filter nodes
      const lowFilter = ctx.createBiquadFilter();
      lowFilter.type = 'lowshelf';
      lowFilter.frequency.value = 150; // low band frequency limit
      lowFilter.gain.value = eqGains.low;

      const midFilter = ctx.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.Q.value = 1.0;
      midFilter.frequency.value = 1000; // mid band frequency
      midFilter.gain.value = eqGains.mid;

      const highFilter = ctx.createBiquadFilter();
      highFilter.type = 'highshelf';
      highFilter.frequency.value = 8000; // high band frequency limit
      highFilter.gain.value = eqGains.high;

      const source = ctx.createMediaElementSource(audioRef.current);
      
      // Connect series: source -> low -> mid -> high -> analyser -> destination
      source.connect(lowFilter);
      lowFilter.connect(midFilter);
      midFilter.connect(highFilter);
      highFilter.connect(analyserNode);
      analyserNode.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyserNode;
      setAnalyser(analyserNode);

      lowFilterRef.current = lowFilter;
      midFilterRef.current = midFilter;
      highFilterRef.current = highFilter;
    } catch (e) {
      console.error('Failed to initialize AudioContext', e);
    }
  };

  const changeEqualizer = (band, val) => {
    setEqGains(prev => {
      const newGains = { ...prev, [band]: val };
      if (band === 'low' && lowFilterRef.current) {
        lowFilterRef.current.gain.value = val;
      } else if (band === 'mid' && midFilterRef.current) {
        midFilterRef.current.gain.value = val;
      } else if (band === 'high' && highFilterRef.current) {
        highFilterRef.current.gain.value = val;
      }
      setEqPreset('custom');
      return newGains;
    });
  };

  const applyPreset = (presetName) => {
    let gains = { low: 0, mid: 0, high: 0 };
    if (presetName === 'bass-boost') {
      gains = { low: 6, mid: 0, high: -2 };
    } else if (presetName === 'voice-clarity') {
      gains = { low: -4, mid: 4, high: 3 };
    } else if (presetName === 'classic-podcast') {
      gains = { low: 2, mid: 3, high: 1 };
    } else if (presetName === 'music') {
      gains = { low: 4, mid: -1, high: 4 };
    }
    
    setEqPreset(presetName);
    setEqGains(gains);

    if (lowFilterRef.current) lowFilterRef.current.gain.value = gains.low;
    if (midFilterRef.current) midFilterRef.current.gain.value = gains.mid;
    if (highFilterRef.current) highFilterRef.current.gain.value = gains.high;
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

  // Bind once; live refs identify the media actually attached to the element.
  useEffect(() => {
    const audio = audioRef.current;
    const onTimeUpdate = () => {
      if (activeMediaRef.current?.ready) setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => {
      const media = activeMediaRef.current;
      if (!media) return;
      if (audio.currentSrc && audio.currentSrc !== media.source) return;
      media.ready = true;
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      const pendingSeek = pendingSeekRef.current;
      if (pendingSeek && pendingSeek.requestId === media.requestId) {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = Math.max(0, Math.min(pendingSeek.position, audio.duration));
        }
        pendingSeekRef.current = null;
      }
      setCurrentTime(audio.currentTime);
    };
    const onPlaying = () => {
      if (!activeMediaRef.current || audio.paused) return;
      if (audio.currentSrc && audio.currentSrc !== activeMediaRef.current.source) return;
      setIsPlaying(true);
      setPlaybackError('');
      progressTracker.start();
    };
    const onPause = () => {
      if (!audio.paused) return;
      setIsPlaying(false);
      void progressTracker.stop();
    };
    const onEnded = () => {
      if (!activeMediaRef.current || !audio.ended) return;
      setIsPlaying(false);
      void progressTracker.stop({ completed: true });
      commandsRef.current.playNext?.();
    };
    const onError = () => {
      if (!activeMediaRef.current) return;
      setIsPlaying(false);
      void progressTracker.stop();
      setPlaybackError('Playback interrupted. Press play to refresh the media link, or try again when connected.');
    };
    const onLifecycleSave = () => { void savePlaybackProgress(false, { keepalive: true }); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onLifecycleSave();
    };
    const handlers = { timeupdate: onTimeUpdate, loadedmetadata: onLoadedMetadata,
      playing: onPlaying, pause: onPause, ended: onEnded, error: onError };
    Object.entries(handlers).forEach(([event, handler]) => audio.addEventListener(event, handler));
    window.addEventListener('pagehide', onLifecycleSave);
    window.addEventListener('library-before-logout', onLifecycleSave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => audio.removeEventListener(event, handler));
      window.removeEventListener('pagehide', onLifecycleSave);
      window.removeEventListener('library-before-logout', onLifecycleSave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [progressTracker, savePlaybackProgress]);
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
  }, [isPlaying, savePlaybackProgress]);

  const playEpisode = async (episode, newPlaylist = []) => {
    if (!episode || !user) return;
    const requestId = ++playRequestRef.current;
    const isSameEpisode = activeMediaRef.current?.episode._id === episode._id;
    const resumePosition = isSameEpisode && !audioRef.current.ended ? audioRef.current.currentTime : 0;
    void progressTracker.stop(); // Capture the outgoing media before any source change.
    audioRef.current.pause();
    setIsPlaying(false);
    setPlaybackError('');
    
    let finalEpisode = { ...episode };
    let downloadedResponse;

    // Cached audio belongs to the signed-in owner. Streaming always resolves a
    // fresh authorized media link and never falls back to an old public URL.
    try {
      const resolved = await resolveEpisodeMedia(episode, {
        readDownload: id => readDownload(user.id || user._id, id),
        fetchEpisode: id => apiFetch(`${API_BASE_URL}/episodes/${id}`),
      });
      finalEpisode = resolved.episode;
      downloadedResponse = resolved.downloadedResponse;
    } catch (err) {
      if (requestId === playRequestRef.current) setPlaybackError(err.message || 'Unable to load media. Please try again.');
      return;
    }
    if (requestId !== playRequestRef.current) return;

    setIsAuthorized(true);

    initAnalyser();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    
    // Increment playCount on the backend asynchronously
    apiFetch(`${API_BASE_URL}/episodes/${finalEpisode._id}/play`, {
      method: 'POST',
    }).catch(err => console.error('Failed to increment play count', err));

    // Track in listen history
    if (token) {
      apiFetch(`${API_BASE_URL}/episodes/${finalEpisode._id}/history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(err => console.error('Failed to add to listen history', err));
    }

    {
      let startPosition = resumePosition;
      const localProgress = progressTracker.latest(user.id || user._id, finalEpisode._id);
      if (!isSameEpisode && localProgress) startPosition = localProgress.completed ? 0 : localProgress.position;
      if (token && !isSameEpisode && !localProgress && !downloadedResponse) {
        try {
          const res = await apiFetch(`${API_BASE_URL}/episodes/${finalEpisode._id}/progress`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok && data.success && data.progress && Number.isFinite(data.progress.position) && data.progress.position >= 0) {
            if (!data.progress.completed) {
              startPosition = data.progress.position;
            }
          }
        } catch (err) {
          console.error('Failed to fetch playback progress:', err);
        }
      }

      if (requestId !== playRequestRef.current) return;
      let mediaUrl;
      if (downloadedResponse) {
        let blob;
        try { blob = await downloadedResponse.blob(); }
        catch {
          if (requestId === playRequestRef.current) setPlaybackError('Unable to read this download. Remove it and download it again.');
          return;
        }
        if (requestId !== playRequestRef.current) return;
        mediaUrl = URL.createObjectURL(blob);
      } else mediaUrl = window.getMediaUrl(finalEpisode.audioUrl);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = downloadedResponse ? mediaUrl : null;
      activeMediaRef.current = { episode: finalEpisode, ownerId: user.id || user._id, ready: false, requestId,
        source: new URL(mediaUrl, window.location.href).href };
      pendingSeekRef.current = { requestId, position: startPosition };
      if (newPlaylist?.length) setPlaylist(newPlaylist);
      setCurrentEpisode(finalEpisode);
      setDuration(0);
      audioRef.current.src = mediaUrl;
      mediaLoadedAtRef.current = Date.now();
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.load();
      setCurrentTime(startPosition);
    }

    // Actual playing/pause events update state, not a potentially stale promise.
    audioRef.current.play().catch(() => {
      if (requestId === playRequestRef.current) setPlaybackError('Unable to start playback. Press play to retry.');
    });
  };

  const togglePlay = () => {
    if (!currentEpisode) return;
    if (!isAuthorized) return; // Block play if not authorized
    if (audioRef.current.paused && (audioRef.current.error || (!blobUrlRef.current && Date.now() - mediaLoadedAtRef.current > 12 * 60 * 1000))) {
      void playEpisode(currentEpisode);
      return;
    }
    setPlaybackError('');

    initAnalyser();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const commandId = ++playRequestRef.current;
    if (!audioRef.current.paused) {
      void progressTracker.stop();
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .catch(() => {
          if (commandId === playRequestRef.current) setPlaybackError('Unable to start playback. Press play to retry.');
        });
    }
  };

  const seek = (time) => {
    if (!activeMediaRef.current?.ready || !Number.isFinite(time)) return;
    const limit = audioRef.current.duration;
    if (!Number.isFinite(limit) || limit <= 0) return;
    const clamped = Math.max(0, Math.min(time, limit));
    audioRef.current.currentTime = clamped;
    setCurrentTime(clamped);
    void savePlaybackProgress();
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

  const closePlayer = () => {
    void progressTracker.stop();
    ++playRequestRef.current;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    activeMediaRef.current = null;
    pendingSeekRef.current = null;
    setCurrentEpisode(null);
    setCurrentTime(0);
    setDuration(0);
    audioRef.current.removeAttribute('src');
    audioRef.current.load();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
  };

  commandsRef.current = { playNext };

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
        closePlayer,
        audioRef,
        isAuthorized,
        playbackError,
        setIsAuthorized,
        eqGains,
        eqPreset,
        changeEqualizer,
        applyPreset,
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
