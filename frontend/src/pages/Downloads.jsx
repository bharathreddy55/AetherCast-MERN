import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { Download, Play, Trash, Music, Calendar, Clock } from 'lucide-react';
import './Pages.css';

export default function Downloads() {
  const { token } = useAuth();
  const { playEpisode, currentEpisode, isPlaying } = usePlayer();

  const [downloadedEpisodes, setDownloadedEpisodes] = useState([]);

  const loadDownloads = () => {
    const saved = JSON.parse(localStorage.getItem('downloads') || '[]');
    setDownloadedEpisodes(saved);
  };

  useEffect(() => {
    loadDownloads();
  }, []);

  const handleDelete = async (episode) => {
    try {
      const url = window.getMediaUrl(episode.audioUrl);
      const cache = await caches.open('vox-audio-v1');
      await cache.delete(url);

      const saved = JSON.parse(localStorage.getItem('downloads') || '[]');
      const filtered = saved.filter((item) => item._id !== episode._id);
      localStorage.setItem('downloads', JSON.stringify(filtered));

      setDownloadedEpisodes(filtered);
    } catch (err) {
      console.error('Failed to delete cached audio file', err);
    }
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="downloads-page animate-fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h2>Offline Downloads</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
          Listen to your downloaded episodes offline anywhere, even without an internet connection.
        </p>
      </header>

      {downloadedEpisodes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {downloadedEpisodes.map((ep) => {
            const isCurrent = currentEpisode && currentEpisode._id === ep._id;
            
            return (
              <div key={ep._id} className="episode-row glass-panel" style={{ padding: '16px 24px' }}>
                <div className="episode-row-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <button 
                    onClick={() => playEpisode(ep, downloadedEpisodes)}
                    className="play-row-btn"
                  >
                    <Play size={16} fill={isCurrent && isPlaying ? 'currentColor' : 'none'} />
                  </button>
                  
                  {ep.podcastId?.coverImage && (
                    <img 
                      src={window.getMediaUrl(ep.podcastId.coverImage)} 
                      alt="Cover" 
                      style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} 
                    />
                  )}

                  <div className="episode-meta-content">
                    <h4 className="episode-row-title" style={{ color: isCurrent ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                      {ep.title}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {ep.podcastId?.title || 'Podcast Show'}
                    </p>
                  </div>
                </div>

                <div className="episode-row-right">
                  <button 
                    onClick={() => handleDelete(ep)}
                    style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    title="Delete Download"
                  >
                    <Trash size={16} style={{ color: '#ef4444' }} />
                  </button>

                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} />
                    {formatDate(ep.publishDate)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} />
                    {formatDuration(ep.duration)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
          <Download size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3>No Downloads Yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '400px', margin: '8px auto 0 auto' }}>
            Click the download button next to any episode on the show details pages to cache them for offline listening.
          </p>
        </div>
      )}
    </div>
  );
}
