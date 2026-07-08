import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { FolderHeart, Plus, Calendar, Music, Trash2, ListMusic } from 'lucide-react';
import './Pages.css';

export default function Playlists() {
  const { token, getAuthHeaders } = useAuth();
  
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchPlaylists = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/playlists`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setPlaylists(data.playlists);
      }
    } catch (err) {
      console.error('Failed to load playlists', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPlaylists();
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/playlists`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (data.success) {
        setPlaylists((prev) => [data.playlist, ...prev]);
        setName('');
        setDescription('');
        setShowForm(false);
      } else {
        setError(data.message || 'Failed to create playlist');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.preventDefault(); // Prevent navigating to details page
    if (!window.confirm('Are you sure you want to delete this playlist?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/playlists/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setPlaylists((prev) => prev.filter((p) => p._id !== id));
      }
    } catch (err) {
      console.error('Delete playlist failed', err);
    }
  };

  return (
    <div className="playlists-page animate-fade-in">
      <header className="section-header" style={{ marginTop: 0 }}>
        <div>
          <h2>Your Playlists</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            Organize episodes into playlists for customized queues and sequential playback.
          </p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="btn-primary"
        >
          <Plus size={16} />
          <span>{showForm ? 'Cancel' : 'Create Playlist'}</span>
        </button>
      </header>

      {/* Creation Form Panel */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '30px', borderRadius: '16px', marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '16px' }}>New Playlist</h3>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Playlist Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Technology Discussions"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea
                placeholder="Describe your playlist..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-input"
                rows="2"
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              Create
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {[1, 2].map((n) => (
            <div key={n} className="skeleton-card glass-panel" style={{ height: '160px', borderRadius: '14px' }}></div>
          ))}
        </div>
      ) : playlists.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {playlists.map((pl) => {
            const ep = pl.episodes && pl.episodes[0];
            const hasCover = ep?.podcastId?.coverImage;

            return (
              <Link 
                key={pl._id} 
                to={`/playlists/${pl._id}`}
                className="glass-panel"
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  padding: '24px', 
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'var(--transition-smooth)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {hasCover ? (
                    <img 
                      src={`window.BACKEND_URL${ep.podcastId.coverImage}`} 
                      alt="Cover" 
                      style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '56px', height: '56px', borderRadius: '8px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <ListMusic size={24} />
                    </div>
                  )}
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '600' }}>{pl.name}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {pl.episodes?.length || 0} episodes
                    </p>
                  </div>
                </div>
                
                {pl.description && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '16px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '36px' }}>
                    {pl.description}
                  </p>
                )}

                <button
                  onClick={(e) => handleDelete(pl._id, e)}
                  style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--text-muted)' }}
                  title="Delete Playlist"
                  onMouseEnter={(e) => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <Trash2 size={16} />
                </button>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty-state glass-panel">
          <FolderHeart size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3>No playlists found</h3>
          <p>Create a playlist and add episodes to organize your feeds!</p>
        </div>
      )}
    </div>
  );
}
