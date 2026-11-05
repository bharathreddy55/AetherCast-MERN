import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, X, Music } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { adjacentMedia, sameMedia, artistNames, formatMusicTime } from '../lib/musicPlayback';
import './MusicPlayer.css';

export default function MusicPlayer() {
  const { currentEpisode: track, isPlaying, currentTime, duration, volume, playlist,
    togglePlay, playNext, playPrevious, seek, changeVolume, closePlayer, playbackError } = usePlayer();
  const index = playlist.findIndex(item => sameMedia(item, track));
  return <section className="music-player" aria-label="Music player">
    {playbackError && <p className="music-player-error" role="alert">{playbackError}</p>}
    <div className="music-player-info">
      {track.coverImage ? <img src={window.getMediaUrl(track.coverImage)} alt="" /> : <Music aria-hidden="true" />}
      <div><strong>{track.title}</strong><span>{artistNames(track)}</span>{track.album && <Link to={`/music?view=tracks&albumId=${encodeURIComponent(track.album._id)}`}>{track.album.title}</Link>}</div>
    </div>
    <div className="music-player-transport">
      <div className="music-player-buttons">
        <button aria-label="Previous song" disabled={!adjacentMedia(playlist, track, -1)} onClick={playPrevious}><SkipBack size={19} /></button>
        <button className="music-play-toggle" aria-label={isPlaying ? 'Pause song' : 'Play song'} onClick={togglePlay}>{isPlaying ? <Pause size={23} /> : <Play size={23} />}</button>
        <button aria-label="Next song" disabled={!adjacentMedia(playlist, track, 1)} onClick={playNext}><SkipForward size={19} /></button>
        <span className="music-queue-count">{index >= 0 ? `${index + 1} / ${playlist.length}` : ''}</span>
      </div>
      <div className="music-player-seek"><span>{formatMusicTime(currentTime)}</span><input aria-label="Song position" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} disabled={!duration} onChange={event => seek(Number(event.target.value))} /><span>{formatMusicTime(duration)}</span></div>
    </div>
    <label className="music-player-volume">Volume<input aria-label="Music volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={event => changeVolume(Number(event.target.value))} /></label>
    <button aria-label="Close music player" onClick={closePlayer}><X size={19} /></button>
  </section>;
}
