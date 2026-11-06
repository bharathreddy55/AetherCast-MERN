import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, X, Volume2, VolumeX, ListMusic, Maximize2, ChevronDown, Shuffle, Repeat, Repeat1, ArrowUp, ArrowDown, Trash2, Heart } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { artistNames, formatMusicTime } from '../lib/musicPlayback';
import { musicShortcut } from '../lib/listeningInterface';
import MusicArtwork from './MusicArtwork';
import './MusicPlayer.css';
import { useMusicLibraryState } from '../lib/useMusicLibraryState';
import PlaylistPicker from './PlaylistPicker';
import MusicLyrics from './MusicLyrics';
import MusicProcessing from './MusicProcessing';
import AppearanceToggle from './AppearanceToggle';
import { audioTechnicalLabel } from '../lib/musicAudioInfo';

function Transport({ compact = false }) {
  const { isPlaying, currentTime, duration, volume, togglePlay, playNext, playPrevious, seek, changeVolume,
    musicQueue, toggleMusicShuffle, cycleMusicRepeat, hasNextMusic, hasPreviousMusic } = usePlayer();
  const [remaining, setRemaining] = useState(false);
  const previousVolume = useRef(volume || .8);
  useEffect(() => { if (volume > 0) previousVolume.current = volume; }, [volume]);
  const mute = () => changeVolume(volume ? 0 : previousVolume.current);
  return <div className={`music-transport ${compact ? 'compact' : ''}`}>
    <div className="music-player-buttons"><button aria-label="Shuffle songs" aria-pressed={musicQueue.shuffle} onClick={toggleMusicShuffle}><Shuffle size={18} /></button><button aria-label="Previous song" disabled={!hasPreviousMusic} onClick={playPrevious}><SkipBack size={22} /></button>
      <button className="music-play-toggle" aria-label={isPlaying ? 'Pause song' : 'Play song'} onClick={togglePlay}>{isPlaying ? <Pause size={25} /> : <Play size={25} />}</button>
      <button aria-label="Next song" disabled={!hasNextMusic} onClick={() => playNext()}><SkipForward size={22} /></button><button aria-label={`Repeat: ${musicQueue.repeat}. Change repeat mode`} aria-pressed={musicQueue.repeat !== 'off'} onClick={cycleMusicRepeat}>{musicQueue.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}</button></div>
    <div className="music-player-seek"><span>{formatMusicTime(currentTime)}</span><input aria-label="Song position" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} disabled={!duration} onChange={event => seek(Number(event.target.value))} /><button className="music-time-mode" aria-label={remaining ? 'Show total duration' : 'Show remaining time'} onClick={() => setRemaining(value => !value)}>{remaining ? `−${formatMusicTime(Math.max(0, duration - currentTime))}` : formatMusicTime(duration)}</button></div>
    {!compact && <div className="music-player-volume"><button onClick={mute} aria-label={volume ? 'Mute music' : 'Unmute music'}>{volume ? <Volume2 size={19} /> : <VolumeX size={19} />}</button><input aria-label="Music volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={event => changeVolume(Number(event.target.value))} /></div>}
  </div>;
}

function QueuePanel() {
  const { queueEntries, musicQueue, playQueueItem, removeMusicQueueItem, moveMusicQueueItem, clearUpcomingMusic } = usePlayer();
  const current = musicQueue.order.indexOf(musicQueue.currentId);
  const [page, setPage] = useState(() => Math.floor(Math.max(0, current) / 100));
  const pages = Math.max(1, Math.ceil(queueEntries.length / 100));
  const visiblePage = Math.min(page, pages - 1);
  return <div className="music-queue-panel">
    <div className="music-queue-tools"><p>Listening order · Repeat {musicQueue.repeat}</p><button onClick={clearUpcomingMusic} disabled={queueEntries.length <= 1}>Keep current only</button></div>
    <ol>{queueEntries.slice(visiblePage * 100, (visiblePage + 1) * 100).map((entry, offset) => {
      const item = entry.track, position = visiblePage * 100 + offset, active = entry.queueItemId === musicQueue.currentId;
      return <li className="music-queue-row" key={entry.queueItemId}>
        <button className="music-queue-select" aria-current={active ? 'true' : undefined} onClick={() => playQueueItem(entry.queueItemId)} aria-label={`${active ? 'Toggle playback of' : 'Play'} ${item.title}`}>
          <span className="music-queue-position">{active ? <Volume2 size={15} /> : position + 1}</span><MusicArtwork src={item.coverImage} title={item.title} /><span><strong>{item.title}</strong><small>{artistNames(item)} · {entry.source === 'manual' ? 'Added by you' : 'Collection'}</small></span><small>{formatMusicTime(item.duration)}</small>
        </button>
        <div className="music-queue-edit"><button aria-label={`Move ${item.title} up`} disabled={position <= current + 1} onClick={() => moveMusicQueueItem(entry.queueItemId, -1)}><ArrowUp size={15} /></button><button aria-label={`Move ${item.title} down`} disabled={position <= current || position === queueEntries.length - 1} onClick={() => moveMusicQueueItem(entry.queueItemId, 1)}><ArrowDown size={15} /></button><button aria-label={`Remove ${item.title} from queue`} onClick={() => removeMusicQueueItem(entry.queueItemId)}><Trash2 size={15} /></button></div>
      </li>;
    })}</ol>
    {pages > 1 && <div className="music-queue-tools"><button disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous entries</button><small>{visiblePage + 1} / {pages}</small><button disabled={visiblePage === pages - 1} onClick={() => setPage(visiblePage + 1)}>Next entries</button></div>}
  </div>;
}

export default function MusicPlayer() {
  const { currentEpisode: track, currentTime, volume, playlist, musicQueue, togglePlay, seek, changeVolume, closePlayer, playbackError, musicQuality, chooseMusicQuality } = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState('playing');
  const [playlistTrack, setPlaylistTrack] = useState(null);
  const library = useMusicLibraryState([track], 'tracks');
  const dialog = useRef(null);
  const commands = useRef(null);
  const lastVolume = useRef(volume || .8);
  useEffect(() => { if (volume > 0) lastVolume.current = volume; }, [volume]);
  commands.current = { togglePlay, seek, currentTime, mute: () => changeVolume(volume ? 0 : lastVolume.current) };
  useEffect(() => {
    const keydown = event => {
      const action = musicShortcut(event);
      if (!action) return;
      event.preventDefault();
      const current = commands.current;
      if (action === 'toggle') current.togglePlay();
      if (action === 'mute') current.mute();
      if (action === 'forward') current.seek(current.currentTime + 5);
      if (action === 'back') current.seek(current.currentTime - 5);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!expanded) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = before; };
  }, [expanded]);
  const index = musicQueue.order.indexOf(musicQueue.currentId);
  const open = value => { setPanel(value); setExpanded(true); };
  return <>
    <section className="music-player" aria-label="Music player">
      {playbackError && !expanded && <p className="music-player-error" role="alert">{playbackError}</p>}
      <button className="music-mini-info" onClick={() => open('playing')} aria-label={`Open Now Playing: ${track.title}`} aria-haspopup="dialog"><MusicArtwork src={track.coverImage} title={track.title} eager /><span><strong>{track.title}</strong><small>{artistNames(track)}</small></span></button>
      <Transport compact />
      <button className="music-mini-playlist" aria-label="Add current song to a playlist" title="Add to playlist" onClick={() => setPlaylistTrack(track)}><ListMusic size={19} /></button>
      <button aria-label={library.saved.includes(track._id) ? 'Unlike current song' : 'Like current song'} aria-pressed={library.saved.includes(track._id)} disabled={!library.ready || library.busy.includes(track._id)} onClick={() => void library.toggle(track._id)}><Heart size={19} fill={library.saved.includes(track._id) ? 'currentColor' : 'none'} /></button>
      <button className="music-open-queue" aria-label="Open current queue" aria-haspopup="dialog" onClick={() => open('queue')}><ListMusic size={21} /><small>{index >= 0 ? `${index + 1}/${playlist.length}` : ''}</small></button>
      <button className="music-expand-button" aria-label="Expand Now Playing" onClick={() => open('playing')}><Maximize2 size={19} /></button>
      <button aria-label="Close music player" onClick={closePlayer}><X size={19} /></button>
    </section>
    <dialog className="music-now-playing" ref={dialog} aria-labelledby="now-playing-title" onCancel={() => setExpanded(false)} onClose={() => setExpanded(false)}>
      {expanded && <>
        {track.coverImage && <img key={track.coverImage} className="music-ambient-art" src={window.getMediaUrl(track.coverImage)} alt="" referrerPolicy="no-referrer" aria-hidden="true" onError={event => { event.currentTarget.style.display = 'none'; }} />}
        <header className="music-now-header"><button onClick={() => setExpanded(false)} aria-label="Minimize Now Playing"><ChevronDown size={25} /></button><h2 id="now-playing-title">Your listening space</h2><div className="music-now-header-actions"><AppearanceToggle /><button onClick={closePlayer} aria-label="Stop and close player"><X size={21} /></button></div></header>
        <div className="music-now-layout"><div className="music-now-art"><MusicArtwork src={track.coverFullImage || track.coverImage} title={track.title} eager /><p>YOUR LIBRARY · PRIVATE LISTENING</p></div>
          <div className="music-now-content"><div className="music-now-tabs" role="group" aria-label="Player view"><button aria-pressed={panel === 'playing'} onClick={() => setPanel('playing')}>Now playing</button><button aria-pressed={panel === 'media'} onClick={() => setPanel('media')}>Audio</button><button aria-pressed={panel === 'lyrics'} onClick={() => setPanel('lyrics')}>Lyrics</button><button aria-pressed={panel === 'queue'} onClick={() => setPanel('queue')}>Queue · {playlist.length}</button></div>
            {panel === 'playing' ? <><div className="music-now-metadata"><h3>{track.title}</h3><p>{artistNames(track)}</p>{track.album && <Link to={`/music?view=tracks&albumId=${encodeURIComponent(track.album._id)}`} onClick={() => setExpanded(false)}>{track.album.title}</Link>}{track.explicit && <small>Explicit</small>}</div><div className="music-player-library-actions"><button aria-pressed={library.saved.includes(track._id)} disabled={!library.ready || library.busy.includes(track._id)} onClick={() => void library.toggle(track._id)}><Heart size={18} fill={library.saved.includes(track._id) ? "currentColor" : "none"} />{library.saved.includes(track._id) ? "Liked" : "Like song"}</button><button onClick={() => setPlaylistTrack(track)}>Add to playlist</button></div><Transport /><p className="music-now-caption">{index >= 0 ? `Song ${index + 1} of ${playlist.length}` : 'Playing from your library'} · {audioTechnicalLabel(track.playback)}</p></> : panel === 'media' ? <><label className="music-audio-quality">Audio version<select value={musicQuality} onChange={event => chooseMusicQuality(event.target.value)}><option value="original">Original</option><option value="compatible">Compatible MP3</option></select></label><MusicProcessing key={track._id} track={track} /><Transport /></> : panel === 'lyrics' ? <><MusicLyrics key={track._id} track={track} /><Transport /></> : <QueuePanel />}
            {playbackError && <p className="music-now-error" role="alert">{playbackError}</p>}
          </div></div>
      </>}
    </dialog>
    {playlistTrack && <PlaylistPicker track={playlistTrack} onClose={() => setPlaylistTrack(null)} />}
    {library.error && <p className="music-library-player-error" role="alert">{library.error} <button onClick={library.reload}>Retry</button></p>}
  </>;
}
