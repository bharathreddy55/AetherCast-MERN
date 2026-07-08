import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { Clock, Play, Heart, Music, Share2 } from 'lucide-react';
import './Pages.css';

export default function ListenHistory() {
  const { token } = useAuth();
  const { playEpisode } = usePlayer();
  const [history, setHistory] = useState([]);
  const [likedEpisodes, setLikedEpisodes] = useState([]);
  const [activeTab, setActiveTab] = useState('history');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
    fetchLiked();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/episodes/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setHistory(data.history);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiked = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/episodes/liked`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setLikedEpisodes(data.episodes);
    } catch (err) {
      console.error('Failed to load liked episodes', err);
    }
  };

  const handleShare = (episode) => {
    const url = `${window.location.origin}/podcast/${episode.podcastId?._id || episode.podcastId}`;
    if (navigator.share) {
      navigator.share({
        title: episode.title,
        text: `Listen to "${episode.title}" on VOX!`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const renderEpisodeRow = (episode, timestamp) => (
    <div key={episode._id + (timestamp || '')} className="glass-panel" style={{
      display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px',
      borderRadius: '12px', marginBottom: '12px', transition: 'all 0.2s ease',
    }}>
      {/* Cover */}
      {episode.podcastId?.coverImage ? (
        <img
          src={window.getMediaUrl(episode.podcastId.coverImage)}
          alt="Cover"
          style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.05)' }}
        />
      ) : (
        <div style={{
          width: '52px', height: '52px', borderRadius: '10px', background: 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)',
          color: 'var(--text-muted)',
        }}>
          <Music size={20} />
        </div>
      )}

      {/* Details */}
      <div style={{ flexGrow: 1, overflow: 'hidden' }}>
        <p style={{ fontWeight: '600', fontSize: '0.9rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
          {episode.title}
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
          {episode.podcastId?.title || 'Unknown Podcast'}
          {timestamp && <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>• {formatDate(timestamp)}</span>}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={() => handleShare(episode)}
          title="Share"
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px', padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <Share2 size={16} />
        </button>
        <button
          onClick={() => playEpisode(episode)}
          title="Play"
          style={{
            background: 'var(--color-primary)', border: 0, borderRadius: '8px',
            padding: '8px 14px', cursor: 'pointer', color: '#fff',
            display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '0.8rem',
          }}
        >
          <Play size={14} fill="currentColor" />
          Play
        </button>
      </div>
    </div>
  );

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 20px 140px' }}>
      <h2 style={{ marginBottom: '8px' }}>Your Library</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>Your listening activity and favorite episodes.</p>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        <button
          onClick={() => setActiveTab('history')}
          className={activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '50px', fontSize: '0.85rem' }}
        >
          <Clock size={16} />
          Listen History
        </button>
        <button
          onClick={() => setActiveTab('liked')}
          className={activeTab === 'liked' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '50px', fontSize: '0.85rem' }}
        >
          <Heart size={16} />
          Liked Episodes ({likedEpisodes.length})
        </button>
      </div>

      {/* Listen History Tab */}
      {activeTab === 'history' && (
        <div>
          {loading ? (
            <div className="skeleton-card glass-panel" style={{ height: '200px', borderRadius: '16px' }}></div>
          ) : history.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px', borderRadius: '16px', textAlign: 'center' }}>
              <Clock size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No listening history yet. Start playing episodes!</p>
            </div>
          ) : (
            history.map((item) =>
              item.episodeId ? renderEpisodeRow(item.episodeId, item.listenedAt) : null
            )
          )}
        </div>
      )}

      {/* Liked Episodes Tab */}
      {activeTab === 'liked' && (
        <div>
          {likedEpisodes.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px', borderRadius: '16px', textAlign: 'center' }}>
              <Heart size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No liked episodes yet. Tap the heart on episodes you love!</p>
            </div>
          ) : (
            likedEpisodes.map((ep) => renderEpisodeRow(ep))
          )}
        </div>
      )}
    </div>
  );
}
