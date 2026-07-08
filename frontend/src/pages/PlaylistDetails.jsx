import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { ListMusic, Play, Trash2, ArrowLeft, Disc, Clock, Plus, Search, X, Check, Loader2 } from 'lucide-react';
import './Pages.css';

export default function PlaylistDetails() {
  const { id } = useParams();
  const { getAuthHeaders } = useAuth();
  const { playEpisode, currentEpisode, isPlaying } = usePlayer();

  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [episodeToRemove, setEpisodeToRemove] = useState(null);

  // Add Episodes States
  const [showAddModal, setShowAddModal] = useState(false);
  const [allEpisodes, setAllEpisodes] = useState([]);
  const [loadingAllEpisodes, setLoadingAllEpisodes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAllEpisodesList = async (query = '') => {
    setLoadingAllEpisodes(true);
    try {
      const res = await fetch(`${API_BASE_URL}/episodes?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setAllEpisodes(data.episodes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAllEpisodes(false);
    }
  };

  const handleAddEpisodeToPlaylist = async (episodeId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/playlists/${id}/episodes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ episodeId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPlaylistDetails();
        alert('Added to playlist!');
      } else {
        alert(data.message || 'Already added');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPlaylistDetails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/playlists/${id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setPlaylist(data.playlist);
      }
    } catch (err) {
      console.error('Failed to load playlist details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylistDetails();
  }, [id]);

  const handlePlayPlaylist = () => {
    if (!playlist || playlist.episodes.length === 0) return;
    // Play first episode and load the rest as the queue playlist
    playEpisode(playlist.episodes[0], playlist.episodes);
  };

  const handleRemoveEpisode = (episodeId) => {
    setEpisodeToRemove(episodeId);
  };

  const confirmRemoveEpisode = async () => {
    if (!episodeToRemove) return;
    try {
      const res = await fetch(`${API_BASE_URL}/playlists/${id}/episodes/${episodeToRemove}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setPlaylist((prev) => ({
          ...prev,
          episodes: prev.episodes.filter((ep) => ep._id !== episodeToRemove),
        }));
      }
    } catch (err) {
      console.error('Failed to remove episode', err);
    } finally {
      setEpisodeToRemove(null);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs} min`;
  };

  if (loading) {
    return (
      <div className="details-page animate-fade-in">
        <div style={{ color: 'var(--text-secondary)' }}>Loading playlist...</div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="details-page animate-fade-in" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h3>Playlist not found</h3>
        <Link to="/playlists" className="btn-primary" style={{ marginTop: '16px' }}>Go to Playlists</Link>
      </div>
    );
  }

  return (
    <div className="details-page animate-fade-in">
      <Link to="/playlists" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        <ArrowLeft size={16} />
        <span>Back to Playlists</span>
      </Link>

      <header className="details-header glass-panel">
        <div className="details-cover-placeholder">
          <ListMusic size={64} style={{ color: 'var(--color-primary-hover)' }} />
        </div>

        <div className="details-info">
          <span className="details-badge">User Playlist</span>
          <h1 className="details-title">{playlist.name}</h1>
          <p className="details-creator" style={{ marginBottom: '12px' }}>
            {playlist.episodes?.length || 0} episodes
          </p>
          {playlist.description && <p className="details-desc">{playlist.description}</p>}
          
          <div className="details-actions" style={{ display: 'flex', gap: '12px' }}>
            {playlist.episodes?.length > 0 && (
              <button onClick={handlePlayPlaylist} className="btn-primary">
                <Play size={18} fill="currentColor" />
                <span>Stream Queue</span>
              </button>
            )}
            <button onClick={() => { setShowAddModal(true); fetchAllEpisodesList(); }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} />
              <span>Add Episodes</span>
            </button>
          </div>
        </div>
      </header>

      {/* Playlist Episodes List */}
      <section className="episodes-list-section">
        <h2>Episodes</h2>

        {playlist.episodes?.length > 0 ? (
          <div>
            {playlist.episodes.map((ep, index) => {
              const isCurrent = currentEpisode && currentEpisode._id === ep._id;

              return (
                <div key={ep._id} className="episode-row glass-panel">
                  <div className="episode-row-left">
                    <button 
                      onClick={() => playEpisode(ep, playlist.episodes)}
                      className="play-row-btn"
                    >
                      <Play size={16} fill={isCurrent && isPlaying ? 'currentColor' : 'none'} />
                    </button>
                    <div className="episode-meta-content">
                      <h4 className="episode-row-title" style={{ color: isCurrent ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                        {ep.title}
                      </h4>
                      <p className="episode-row-desc">{ep.podcastId?.title || 'Single Episode'}</p>
                    </div>
                  </div>

                  <div className="episode-row-right">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} />
                      {formatDuration(ep.duration)}
                    </span>
                    <button
                      onClick={() => handleRemoveEpisode(ep._id)}
                      className="comment-delete-btn"
                      title="Remove from Playlist"
                      style={{ opacity: 1 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state glass-panel">
            <ListMusic size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h3>Playlist is empty</h3>
            <p>Go to your followed podcasts, explore shows, and add episodes to this playlist!</p>
          </div>
        )}
      </section>

      {/* Custom Confirmation Modal */}
      {episodeToRemove && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <div className="glass-panel" style={{
            padding: '24px',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <Trash2 size={40} style={{ color: '#ef4444', marginBottom: '16px', margin: '0 auto 16px' }} />
            <h3 style={{ color: '#fff', marginBottom: '8px' }}>Remove Episode?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Are you sure you want to remove this episode from your playlist?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setEpisodeToRemove(null)}
                className="btn-secondary" 
                style={{ padding: '8px 20px', borderRadius: '50px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmRemoveEpisode}
                className="btn-primary" 
                style={{ padding: '8px 20px', borderRadius: '50px', background: '#ef4444', borderColor: '#ef4444', cursor: 'pointer' }}
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Episodes Modal Overlay */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <div className="glass-panel" style={{
            padding: '24px',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Add Episodes to Playlist</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 0, color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search episodes by title..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchAllEpisodesList(e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            {/* Scrollable list */}
            <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '45vh', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loadingAllEpisodes ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} />
                </div>
              ) : allEpisodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  No episodes found.
                </div>
              ) : (
                allEpisodes.map((ep) => {
                  const alreadyInPlaylist = playlist.episodes?.some(item => item._id === ep._id);
                  return (
                    <div 
                      key={ep._id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '10px 12px', 
                        background: 'rgba(255,255,255,0.01)', 
                        border: '1px solid rgba(255,255,255,0.03)', 
                        borderRadius: '8px' 
                      }}
                    >
                      <div style={{ textAlign: 'left', maxWidth: '75%' }}>
                        <h5 style={{ margin: 0, color: '#fff', fontSize: '0.85rem' }}>{ep.title}</h5>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {ep.podcastId?.title || 'Podcast'}
                        </p>
                      </div>

                      {alreadyInPlaylist ? (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={14} /> Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddEpisodeToPlaylist(ep._id)}
                          className="btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
