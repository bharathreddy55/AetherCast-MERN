import { apiFetch } from '../lib/apiClient';
import React, { createContext, useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import { useAuth, API_BASE_URL } from './AuthContext';
import { readDownload } from '../lib/downloads';
import { resolvePlayerMedia, isMusic, sameMedia, adjacentMedia, episodeProgressSnapshot } from '../lib/musicPlayback';
import { createProgressTracker, createProgressSender } from '../lib/playbackProgress';
import { emptyMusicQueue, musicQueueReducer, musicEntries, queueEntry, orderedQueue, nextQueueId, previousQueueId, selectMusicOccurrence } from '../lib/musicQueue';
import { createMusicListeningTracker, createMusicListeningSender } from '../lib/musicListening';
import { createMusicMediaSession } from '../lib/musicMediaSession';
import { recoveryPosition, createAudioPlayback, playbackPausedIntent } from '../lib/playbackRecovery';
import { createMusicLinkRenewal, musicLinkExpiry, musicLinkNeedsRenewal } from '../lib/musicLinkRenewal';
import { createNextMusicPreparation, shouldPrepareNext, readNextPreparation, saveNextPreparation, atMusicBoundary } from '../lib/nextMusicPreparation';

const PlayerContext = createContext(null);

export const PlayerProvider = ({ children }) => {
  const { token, user, loading: authLoading } = useAuth();
  
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [musicQuality, setMusicQuality] = useState('original');
  const musicQualityRef = useRef('original');
  const [prepareNextEnabled, setPrepareNextEnabled] = useState(() => { try { return readNextPreparation(window.localStorage); } catch { return true; } });
  const prepareNextEnabledRef = useRef(prepareNextEnabled);
  const nextPreparationRef = useRef(null);
  if (!nextPreparationRef.current) nextPreparationRef.current = createNextMusicPreparation({
    load: (item, { signal, quality }) => resolvePlayerMedia(item, {
      fetchTrack: id => apiFetch(`${API_BASE_URL}/music/tracks/${id}/playback?quality=${quality}`, { signal }),
    }),
  });
  const [playlist, setPlaylist] = useState([]);
  const [musicQueue, setMusicQueue] = useState(emptyMusicQueue);
  const musicQueueEntries = useMemo(() => orderedQueue(musicQueue), [musicQueue]);
  const musicPlaylist = useMemo(() => musicQueueEntries.map(entry => ({ ...entry.track, queueItemId: entry.queueItemId })), [musicQueueEntries]);
  const musicQueueRef = useRef(musicQueue);
  const updateMusicQueue = action => {
    const next = musicQueueReducer(musicQueueRef.current, action);
    musicQueueRef.current = next;
    setMusicQueue(next);
    return next;
  };
  const [subtitles, setSubtitles] = useState([]);
  const [analyser, setAnalyser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [playbackError, setPlaybackError] = useState('');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [eqGains, setEqGains] = useState({ low: 0, mid: 0, high: 0 });
  const [eqPreset, setEqPreset] = useState('flat');
  
  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = document.createElement('video');
    audioRef.current.playsInline = true;
    audioRef.current.setAttribute('playsinline', '');
    audioRef.current.preload = 'metadata';
  }
  const playRequestRef = useRef(0);
  const blobUrlRef = useRef(null);
  const mediaLoadedAtRef = useRef(0);
  const activeMediaRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const commandsRef = useRef({});
  const sessionBlockedRef = useRef(!user);
  const mediaSessionRef = useRef(null);
  const selectionAbortRef = useRef(null);
  const mediaLoadingRef = useRef(false);
  const bufferingRef = useRef(false);
  const retryPositionRef = useRef(null);
  const playIntentRef = useRef(false);
  const linkRenewalRef = useRef(null);
  const audioPlayRef = useRef(null);
  if (!audioPlayRef.current) audioPlayRef.current = createAudioPlayback({
    getAudio: () => audioRef.current, canPlay: () => !sessionBlockedRef.current,
    getRevision: () => playRequestRef.current, onError: message => { playIntentRef.current = false; setIsReconnecting(false); setPlaybackError(message); },
  });
  const updateDeviceSession = useCallback(() => mediaSessionRef.current?.update(), []);
  const authRef = useRef(null);
  authRef.current = { token, ownerId: user?.id || user?._id };
  if (!linkRenewalRef.current) linkRenewalRef.current = createMusicLinkRenewal({
    getSnapshot: () => {
      const media = activeMediaRef.current, auth = authRef.current;
      return { allowed: !sessionBlockedRef.current && !!auth?.token && media?.ownerId === auth?.ownerId
          && (!media?.episode.queueItemId || media.episode.queueItemId === musicQueueRef.current.currentId),
        media, audio: audioRef.current, loading: mediaLoadingRef.current, playIntent: playIntentRef.current, quality: musicQualityRef.current };
    },
    renew: options => commandsRef.current.renewMusic?.(options),
    onFailure: () => { commandsRef.current.pause?.(); setIsReconnecting(false); setPlaybackError('Unable to refresh playback. Press play to retry.'); },
  });
  useEffect(() => {
    sessionBlockedRef.current = !user || !token || authLoading;
    updateDeviceSession();
  }, [user, token, authLoading, updateDeviceSession]);
  useEffect(() => {
    const bridge = createMusicMediaSession({ session: navigator.mediaSession, Metadata: window.MediaMetadata,
      getCommands: () => commandsRef.current,
      getSnapshot: () => {
        const media = activeMediaRef.current, audio = audioRef.current;
        return { allowed: !sessionBlockedRef.current && !!authRef.current?.token && media?.ownerId === authRef.current?.ownerId && !mediaLoadingRef.current,
          canCancel: !sessionBlockedRef.current && !!authRef.current?.token && mediaLoadingRef.current && isMusic(retryPositionRef.current?.item),
          track: media?.episode, audio, ready: !!media?.ready, buffering: bufferingRef.current,
          hasNext: !!nextQueueId(musicQueueRef.current), hasPrevious: audio.currentTime > 3 || !!previousQueueId(musicQueueRef.current) };
      },
    });
    mediaSessionRef.current = bridge; bridge.update();
    return () => { bridge.dispose(); if (mediaSessionRef.current === bridge) mediaSessionRef.current = null; };
  }, []);
  useEffect(() => { updateDeviceSession(); }, [currentEpisode, isPlaying, currentTime, duration, musicQueue, updateDeviceSession]);
  const musicListeningRef = useRef(null);
  if (!musicListeningRef.current) {
    const sender = createMusicListeningSender(API_BASE_URL);
    musicListeningRef.current = createMusicListeningTracker({
      send: async (...args) => { await sender(...args); window.dispatchEvent(new Event('music-history-changed')); },
      getAuth: () => authRef.current, onError: () => console.warn('Music listening history could not be saved.'),
    });
  }
  const musicListening = musicListeningRef.current;
  const progressTrackerRef = useRef(null);
  if (!progressTrackerRef.current) progressTrackerRef.current = createProgressTracker({
    getSnapshot: () => {
      const media = activeMediaRef.current;
      const auth = authRef.current;
      return episodeProgressSnapshot(media, auth, audioRef.current);
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
      musicListening.reset(audio.currentTime, { keepalive: true });
      ++playRequestRef.current;
      selectionAbortRef.current?.abort();
      playIntentRef.current = false; linkRenewalRef.current.reset();
      nextPreparationRef.current.reset();
      audio.pause();
      activeMediaRef.current = null;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    };
  }, [progressTracker, musicListening]);

  useEffect(() => {
    if (user) return;
    sessionBlockedRef.current = true;
    selectionAbortRef.current?.abort();
    audioPlayRef.current.cancel();
    mediaLoadingRef.current = false;
    retryPositionRef.current = null;
    playIntentRef.current = false; linkRenewalRef.current.reset();
    nextPreparationRef.current.reset();
    musicQualityRef.current = 'original'; setMusicQuality('original');
    mediaSessionRef.current?.clear();
    void progressTracker.stop({ save: false });
    progressTracker.clear();
    musicListening.reset(audioRef.current.currentTime, { keepalive: true });
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
    const clearedQueue = emptyMusicQueue();
    musicQueueRef.current = clearedQueue;
    setMusicQueue(clearedQueue);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError('');
    setIsReconnecting(false);
  }, [user, authLoading, progressTracker, musicListening]);
  
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
      if (activeMediaRef.current?.ready && !audio.error && Number.isFinite(audio.currentTime)) {
        activeMediaRef.current.lastPosition = audio.currentTime; setCurrentTime(audio.currentTime);
        commandsRef.current.prepareNext?.();
      }
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
      media.lastPosition = audio.currentTime;
      updateDeviceSession();
    };
    const onPlaying = () => {
      if (!activeMediaRef.current || audio.paused) return;
      if (audio.currentSrc && audio.currentSrc !== activeMediaRef.current.source) return;
      setIsPlaying(true);
      setIsReconnecting(false);
      bufferingRef.current = false;
      playIntentRef.current = true; linkRenewalRef.current.playing();
      setPlaybackError('');
      if (isMusic(activeMediaRef.current.episode)) musicListening.playing(audio.currentTime);
      progressTracker.start();
      updateDeviceSession();
    };
    const onPause = () => {
      if (!audio.paused) return;
      if (!mediaLoadingRef.current && !audio.error) playIntentRef.current = false;
      if (!mediaLoadingRef.current && !atMusicBoundary(audio)) nextPreparationRef.current.cancel();
      linkRenewalRef.current.cancel();
      setIsPlaying(false);
      musicListening.pause();
      void progressTracker.stop();
      updateDeviceSession();
    };
    const onEnded = () => {
      if (!activeMediaRef.current || !audio.ended) return;
      setIsPlaying(false);
      playIntentRef.current = false; linkRenewalRef.current.cancel();
      musicListening.finish('completed', audio.currentTime);
      void progressTracker.stop({ completed: true });
      commandsRef.current.playNext?.({ natural: true });
      updateDeviceSession();
    };
    const onError = () => {
      if (!activeMediaRef.current || !audio.error || mediaLoadingRef.current) return;
      if (audio.currentSrc && audio.currentSrc !== activeMediaRef.current.source) return;
      nextPreparationRef.current.cancel();
      setIsPlaying(false);
      bufferingRef.current = false;
      musicListening.pause();
      void progressTracker.stop();
      if (!linkRenewalRef.current.interrupted()) {
        playIntentRef.current = false; audio.pause();
        setIsReconnecting(false);
        setPlaybackError('Playback interrupted. Press play to refresh the media link, or try again when connected.');
      }
      updateDeviceSession();
    };
    const onLifecycleSave = event => {
      void savePlaybackProgress(false, { keepalive: true });
      if (['pagehide', 'library-before-logout'].includes(event?.type)) {
        musicListening.reset(audio.currentTime, { keepalive: true });
        sessionBlockedRef.current = true;
        playIntentRef.current = false; linkRenewalRef.current.reset();
        nextPreparationRef.current.reset();
        ++playRequestRef.current; selectionAbortRef.current?.abort();
        mediaLoadingRef.current = false; audioPlayRef.current.cancel(); retryPositionRef.current = null;
        audio.pause(); activeMediaRef.current = null; pendingSeekRef.current = null;
        audio.removeAttribute('src'); audio.load(); setIsPlaying(false);
        setIsReconnecting(false);
        mediaSessionRef.current?.clear();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onLifecycleSave();
    };
    const onBuffering = () => {
      if (!activeMediaRef.current || (audio.currentSrc && audio.currentSrc !== activeMediaRef.current.source)) return;
      nextPreparationRef.current.cancel();
      musicListening.pause(); bufferingRef.current = true; linkRenewalRef.current.waiting(); updateDeviceSession();
    };
    const handlers = { timeupdate: onTimeUpdate, loadedmetadata: onLoadedMetadata,
      playing: onPlaying, pause: onPause, ended: onEnded, error: onError, waiting: onBuffering, stalled: onBuffering,
      seeked: updateDeviceSession, durationchange: updateDeviceSession, ratechange: updateDeviceSession };
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
  }, [progressTracker, savePlaybackProgress, musicListening, updateDeviceSession]);
  // Adjust volume
  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  // Adjust playback speed
  useEffect(() => {
    audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // A reported device change is a conservative pause, not proof of headphone removal.
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      const handleDeviceChange = () => {
        if (activeMediaRef.current || mediaLoadingRef.current) commandsRef.current.pause?.();
      };
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, []);

  const playEpisode = async (episode, newPlaylist = null, options = {}) => {
    if (!episode || !user || sessionBlockedRef.current) return;
    if (!options.preparationContext) nextPreparationRef.current.reset();
    if (!isMusic(episode)) updateMusicQueue({ type: 'reset' });
    const requestId = ++playRequestRef.current;
    linkRenewalRef.current.cancel();
    if (!options.linkRenewal) linkRenewalRef.current.reset();
    playIntentRef.current = !options.keepPaused;
    setIsReconnecting(!!options.linkRenewal);
    const isSameEpisode = sameMedia(activeMediaRef.current?.episode, episode);
    const outgoing = activeMediaRef.current?.episode || retryPositionRef.current?.item;
    const outgoingPosition = activeMediaRef.current ? audioRef.current.error && Number.isFinite(activeMediaRef.current.lastPosition)
      ? Math.max(activeMediaRef.current.lastPosition, audioRef.current.currentTime || 0) : audioRef.current.currentTime : retryPositionRef.current?.position || 0;
    const resumePosition = isMusic(episode) && Number.isFinite(options.position) ? Math.max(0, options.position)
      : recoveryPosition({ item: episode, active: activeMediaRef.current?.episode, audio: audioRef.current,
        retry: retryPositionRef.current, ownerId: user.id || user._id, restart: options.restart, lastPosition: activeMediaRef.current?.lastPosition });
    retryPositionRef.current = isMusic(episode) ? { ownerId: user.id || user._id,
      item: { _id: episode._id, kind: 'track', queueItemId: episode.queueItemId }, position: resumePosition } : null;
    selectionAbortRef.current?.abort();
    const controller = new AbortController(); selectionAbortRef.current = controller;
    mediaLoadingRef.current = true; audioPlayRef.current.cancel();
    updateDeviceSession();
    if (isMusic(outgoing)) {
      if (!sameMedia(outgoing, episode) || options.restart) musicListening.finish('skipped', outgoingPosition);
      else musicListening.pause();
    }
    void progressTracker.stop(); // Capture the outgoing media before any source change.
    audioRef.current.pause();
    setIsPlaying(false);
    setPlaybackError('');
    
    let finalEpisode = { ...episode };
    let downloadedResponse;
    let expiresAt = null;
    let requestedAt = Date.now();

    // Cached episode audio belongs to the signed-in owner. Music resolves an
    // authorized link here or consumes a bounded same-session preparation.
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const contextMatches = () => prepareNextEnabledRef.current && options.preparationContext
        && options.preparationContext.ownerId === authRef.current?.ownerId && options.preparationContext.token === authRef.current?.token
        && options.preparationContext.quality === musicQualityRef.current && options.preparationContext.from === activeMediaRef.current?.episode.queueItemId
        && options.preparationContext.requestId === activeMediaRef.current?.requestId && options.preparationContext.to === episode.queueItemId
        && episode.queueItemId === musicQueueRef.current.currentId;
      const prepared = contextMatches() ? await nextPreparationRef.current.take(options.preparationContext, controller.signal) : undefined;
      if (controller.signal.aborted) throw new Error('Playback request cancelled');
      const usePrepared = prepared && contextMatches();
      requestedAt = usePrepared ? prepared.requestedAt : Date.now();
      const resolved = usePrepared ? prepared.resolved : await resolvePlayerMedia(episode, {
        readDownload: id => readDownload(user.id || user._id, id),
        fetchEpisode: id => apiFetch(`${API_BASE_URL}/episodes/${id}`, { signal: controller.signal }),
        fetchTrack: id => apiFetch(`${API_BASE_URL}/music/tracks/${id}/playback?quality=${musicQualityRef.current}`, { signal: controller.signal }),
      });
      if (controller.signal.aborted) throw new Error('Playback request cancelled');
      finalEpisode = resolved.episode;
      downloadedResponse = resolved.downloadedResponse;
      expiresAt = musicLinkExpiry(resolved.expiresIn, requestedAt);
    } catch (err) {
      if (requestId === playRequestRef.current) {
        mediaLoadingRef.current = false;
        playIntentRef.current = false;
        setIsReconnecting(false);
        activeMediaRef.current = null;
        mediaSessionRef.current?.clear();
        setPlaybackError(controller.signal.aborted ? 'Playback request timed out. Press play to retry.' : err.message || 'Unable to load media. Please try again.');
        if (isMusic(episode)) {
          activeMediaRef.current = null;
          pendingSeekRef.current = null;
          audioRef.current.removeAttribute('src'); audioRef.current.load();
          setCurrentEpisode(episode); setCurrentTime(resumePosition); setDuration(0);
        }
      }
      return;
    } finally { clearTimeout(timeout); }
    if (requestId !== playRequestRef.current) return;

    setIsAuthorized(true);

    initAnalyser();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    
    // Increment playCount on the backend asynchronously
    if (!isMusic(finalEpisode)) apiFetch(`${API_BASE_URL}/episodes/${finalEpisode._id}/play`, {
      method: 'POST',
    }).catch(err => console.error('Failed to increment play count', err));

    // Track in listen history
    if (token && !isMusic(finalEpisode)) {
      apiFetch(`${API_BASE_URL}/episodes/${finalEpisode._id}/history`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(err => console.error('Failed to add to listen history', err));
    }

    {
      let startPosition = resumePosition;
      const localProgress = !isMusic(finalEpisode) && progressTracker.latest(user.id || user._id, finalEpisode._id);
      if (!isSameEpisode && localProgress) startPosition = localProgress.completed ? 0 : localProgress.position;
      if (!isMusic(finalEpisode) && token && !isSameEpisode && !localProgress && !downloadedResponse) {
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
      activeMediaRef.current = { episode: finalEpisode, ownerId: user.id || user._id, ready: false, requestId, expiresAt, lastPosition: startPosition, quality: musicQualityRef.current,
        source: new URL(mediaUrl, window.location.href).href };
      if (isMusic(finalEpisode)) musicListening.attach({ track: finalEpisode, ownerId: user.id || user._id, queueItemId: finalEpisode.queueItemId });
      pendingSeekRef.current = { requestId, position: startPosition };
      if (!isMusic(finalEpisode)) {
        if (Array.isArray(newPlaylist)) setPlaylist(newPlaylist);
        else if (!isSameEpisode && !playlist.some(item => sameMedia(item, episode))) setPlaylist([episode]);
      }
      if (isMusic(finalEpisode)) { setPlaybackSpeed(1); audioRef.current.playbackRate = 1; }
      setCurrentEpisode(finalEpisode);
      setDuration(0);
      audioRef.current.src = mediaUrl;
      mediaLoadedAtRef.current = Date.now();
      audioRef.current.playbackRate = isMusic(finalEpisode) ? 1 : playbackSpeed;
      audioRef.current.load();
      setCurrentTime(startPosition);
      mediaLoadingRef.current = false;
      bufferingRef.current = false;
      updateDeviceSession();
    }

    // Actual playing/pause events update state, not a potentially stale promise.
    if (options.keepPaused) setIsReconnecting(false);
    if (!options.keepPaused) startAudioPlayback(requestId);
  };

  const startAudioPlayback = requestId => {
    audioPlayRef.current.play(requestId);
  };
  const pausePlayback = () => {
    nextPreparationRef.current.cancel();
    playIntentRef.current = false; linkRenewalRef.current.cancel();
    setIsReconnecting(false);
    ++playRequestRef.current; selectionAbortRef.current?.abort();
    mediaLoadingRef.current = false; audioPlayRef.current.cancel();
    void progressTracker.stop(); audioRef.current.pause(); setIsPlaying(false);
    updateDeviceSession();
  };
  const playPlayback = () => {
    const selected = activeMediaRef.current?.episode || currentEpisode;
    if (!selected || !user || sessionBlockedRef.current || !isAuthorized || mediaLoadingRef.current || audioPlayRef.current.pending() || !audioRef.current.paused) return;
    if (isMusic(selected) && selected.queueItemId !== musicQueueRef.current.currentId) {
      playMusicState(musicQueueRef.current);
      return;
    }
    if (!activeMediaRef.current || !sameMedia(activeMediaRef.current.episode, selected) ||
      (audioRef.current.paused && (audioRef.current.error || (isMusic(selected) && musicLinkNeedsRenewal(activeMediaRef.current))
        || (!blobUrlRef.current && !activeMediaRef.current.expiresAt && Date.now() - mediaLoadedAtRef.current > 12 * 60 * 1000)))) {
      void playEpisode(selected);
      return;
    }
    setPlaybackError('');

    initAnalyser();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    playIntentRef.current = true; startAudioPlayback(++playRequestRef.current);
  };
  const togglePlay = () => { if (mediaLoadingRef.current || audioPlayRef.current.pending() || !audioRef.current.paused) pausePlayback(); else playPlayback(); };

  const seek = (time) => {
    if (!activeMediaRef.current?.ready || mediaLoadingRef.current || !Number.isFinite(time)) return;
    nextPreparationRef.current.cancel();
    const limit = audioRef.current.duration;
    if (!Number.isFinite(limit) || limit <= 0) return;
    const clamped = Math.max(0, Math.min(time, limit));
    if (isMusic(activeMediaRef.current.episode) && linkRenewalRef.current.seek(clamped)) return;
    activeMediaRef.current.lastPosition = clamped;
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

  const keepPlaybackPaused = () => playbackPausedIntent({ audio: audioRef.current, loading: mediaLoadingRef.current, playIntent: playIntentRef.current });
  const playMusicState = (state, options = {}) => {
    const entry = queueEntry(state);
    if (entry) void playEpisode({ ...entry.track, queueItemId: entry.queueItemId }, null, options);
  };
  const playTrack = (track, tracks = [track], startIndex) => {
    if (!user || !track) return;
    const entries = musicEntries(tracks);
    const selected = selectMusicOccurrence(entries, track, startIndex);
    if (!selected) { setPlaybackError('This song is no longer in the selected collection. Refresh and try again.'); return; }
    playMusicState(updateMusicQueue({ type: 'replace', items: entries, currentId: selected.queueItemId }), { restart: true });
  };
  const playQueueItem = id => {
    if (!user || !queueEntry(musicQueueRef.current, id)) return;
    if (currentEpisode?.queueItemId === id) { togglePlay(); return; }
    playMusicState(updateMusicQueue({ type: 'select', id }), { restart: true });
  };
  const addToMusicQueue = (track, next = false) => {
    if (!user) return;
    try {
      const wasMusic = isMusic(currentEpisode);
      if (!wasMusic) updateMusicQueue({ type: 'reset' });
      const state = updateMusicQueue({ type: 'add', entry: musicEntries([track], 'manual')[0], next });
      if (!wasMusic) playMusicState(state, { keepPaused: true, restart: true });
      return true;
    } catch (error) { setPlaybackError(error.message); return false; }
  };
  const removeMusicQueueItem = id => {
    if (!queueEntry(musicQueueRef.current, id)) return;
    const active = musicQueueRef.current.currentId === id;
    const keepPaused = keepPlaybackPaused();
    const state = updateMusicQueue({ type: 'remove', id });
    if (active) {
      if (state.currentId) playMusicState(state, { keepPaused, restart: true });
      else closePlayer();
    }
  };
  const playNext = ({ natural = false } = {}) => {
    if (isMusic(activeMediaRef.current?.episode || currentEpisode)) {
      if (nextQueueId(musicQueueRef.current, natural)) {
        const keepPaused = !natural && keepPlaybackPaused();
        const preparationContext = natural ? preparationKey() : null;
        playMusicState(updateMusicQueue({ type: 'next', natural }), { restart: true, keepPaused, preparationContext });
      } else nextPreparationRef.current.reset();
      return;
    }
    if (playlist.length === 0 || !currentEpisode) return;
    const next = adjacentMedia(playlist, currentEpisode, 1);
    if (next) playEpisode(next);
  };

  const playPrevious = () => {
    if (isMusic(activeMediaRef.current?.episode || currentEpisode)) {
      const position = audioRef.current.error ? activeMediaRef.current?.lastPosition || 0 : audioRef.current.currentTime;
      if (position > 3 && activeMediaRef.current?.ready) {
        if (mediaLoadingRef.current || audioRef.current.error) void playEpisode(activeMediaRef.current.episode, null, { restart: true, keepPaused: keepPlaybackPaused() });
        else seek(0);
        return;
      }
      if (previousQueueId(musicQueueRef.current)) playMusicState(updateMusicQueue({ type: 'previous' }), { restart: true, keepPaused: keepPlaybackPaused() });
      return;
    }
    if (playlist.length === 0 || !currentEpisode) return;
    const previous = adjacentMedia(playlist, currentEpisode, -1);
    if (previous) playEpisode(previous);
  };

  const closePlayer = () => {
    nextPreparationRef.current.reset();
    playIntentRef.current = false; linkRenewalRef.current.reset();
    setIsReconnecting(false);
    selectionAbortRef.current?.abort();
    mediaLoadingRef.current = false; audioPlayRef.current.cancel(); retryPositionRef.current = null;
    mediaSessionRef.current?.clear();
    musicListening.reset(audioRef.current.currentTime);
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
    updateMusicQueue({ type: 'reset' });
    setPlaylist([]);
    audioRef.current.removeAttribute('src');
    audioRef.current.load();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
  };

  const preparationKey = () => {
    const media = activeMediaRef.current, auth = authRef.current, next = queueEntry(musicQueueRef.current, nextQueueId(musicQueueRef.current, true));
    if (!media || !next || sessionBlockedRef.current || !auth?.token || media.ownerId !== auth.ownerId || !media.episode.queueItemId) return null;
    return { ownerId: auth.ownerId, token: auth.token, quality: musicQualityRef.current, from: media.episode.queueItemId,
      to: next.queueItemId, requestId: media.requestId, trackId: next.track._id };
  };
  const prepareNext = () => {
    const media = activeMediaRef.current, key = preparationKey(), next = key && queueEntry(musicQueueRef.current, key.to);
    // The final timeupdate/pause may precede ended. Keep the prepared response
    // until the natural handoff instead of cancelling it at remaining=0.
    if (isMusic(media?.episode) && atMusicBoundary(audioRef.current)) return;
    if (!key || !shouldPrepareNext({ enabled: prepareNextEnabledRef.current, allowed: !!key, loading: mediaLoadingRef.current,
      buffering: bufferingRef.current, media, audio: audioRef.current, next })) { nextPreparationRef.current.cancel(); return; }
    nextPreparationRef.current.prepare(key, { ...next.track, queueItemId: next.queueItemId });
  };
  const changePrepareNext = enabled => {
    if (typeof enabled !== 'boolean') return;
    prepareNextEnabledRef.current = enabled; setPrepareNextEnabled(enabled); nextPreparationRef.current.reset();
    try { saveNextPreparation(window.localStorage, enabled); } catch { /* Storage access is optional. */ }
  };
  commandsRef.current = { playNext, play: playPlayback, pause: pausePlayback, stop: closePlayer, next: () => playNext(), previous: playPrevious, seek, prepareNext,
    renewMusic: ({ item, position, keepPaused }) => playEpisode(item, null, { position, keepPaused, linkRenewal: true }) };
  const chooseMusicQuality = value => {
    if (!['original', 'compatible', 'normalized'].includes(value) || sessionBlockedRef.current) return;
    musicQualityRef.current = value; setMusicQuality(value);
    if (isMusic(currentEpisode)) void playEpisode(currentEpisode, null, { keepPaused: keepPlaybackPaused() });
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
        playlist: isMusic(currentEpisode) ? musicPlaylist : playlist,
        musicQueue,
        queueEntries: musicQueueEntries,
        playQueueItem,
        addToMusicQueue,
        removeMusicQueueItem,
        moveMusicQueueItem: (id, offset) => updateMusicQueue({ type: 'move', id, offset }),
        clearUpcomingMusic: () => updateMusicQueue({ type: 'clearUpcoming' }),
        toggleMusicShuffle: () => updateMusicQueue({ type: 'shuffle' }),
        cycleMusicRepeat: () => updateMusicQueue({ type: 'repeat', value: ({ off: 'all', all: 'one', one: 'off' })[musicQueueRef.current.repeat] }),
        hasNextMusic: !!nextQueueId(musicQueue),
        hasPreviousMusic: currentTime > 3 || !!previousQueueId(musicQueue),
        subtitles,
        currentSubtitle,
        analyser,
        playEpisode,
        playTrack,
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
        isReconnecting,
        musicQuality,
        chooseMusicQuality,
        prepareNextEnabled,
        changePrepareNext,
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
