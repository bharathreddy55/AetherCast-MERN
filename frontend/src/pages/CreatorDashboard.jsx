import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { 
  BarChart3, PlusCircle, Radio, FolderPlus, 
  Trash2, Upload, FileAudio, Users, Layers, Play, Mic 
} from 'lucide-react';
import AnalyticsCharts from '../components/AnalyticsCharts';
import RecordingBooth from '../components/RecordingBooth';
import './Pages.css';

export default function CreatorDashboard() {
  const { token, getAuthHeaders, user } = useAuth();
  
  // State
  const [activeTab, setActiveTab] = useState('analytics'); // analytics, podcasts, create-podcast, add-episode
  const [myPodcasts, setMyPodcasts] = useState([]);
  const [loadingPodcasts, setLoadingPodcasts] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    totalPodcasts: 0,
    totalEpisodes: 0,
    totalFollowers: 0,
    totalPlays: 0
  });

  const [creatorStats, setCreatorStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchCreatorStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/creator`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setCreatorStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load creator stats', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Create Podcast Form State
  const [pTitle, setPTitle] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pCategory, setPCategory] = useState('Technology');
  const [pTags, setPTags] = useState('');
  const [pLanguage, setPLanguage] = useState('English');
  const [pStatus, setPStatus] = useState('published');
  const [pCover, setPCover] = useState(null);
  const [pBanner, setPBanner] = useState(null);
  const [pSubmitting, setPSubmitting] = useState(false);
  const [pError, setPError] = useState('');
  const [pSuccess, setPSuccess] = useState(false);

  // Add Episode Form State
  const [epPodcastId, setEpPodcastId] = useState('');
  const [epTitle, setEpTitle] = useState('');
  const [epDescription, setEpDescription] = useState('');
  const [epTranscript, setEpTranscript] = useState('');
  const [epDuration, setEpDuration] = useState('');
  const [epStatus, setEpStatus] = useState('published');
  const [epAudio, setEpAudio] = useState(null);
  const [epSubmitting, setEpSubmitting] = useState(false);
  const [epError, setEpError] = useState('');
  const [epSuccess, setEpSuccess] = useState(false);

  // Fetch Podcasts & Compute Stats
  const fetchMyPodcasts = async () => {
    setLoadingPodcasts(true);
    try {
      const res = await fetch(`${API_BASE_URL}/podcasts?creatorId=${user.id || user._id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setMyPodcasts(data.podcasts);
        
        // Compute stats
        let totalEpCount = 0;
        let totalFollowCount = 0;
        data.podcasts.forEach((p) => {
          totalEpCount += p.episodeCount || 0;
          totalFollowCount += p.followersCount || 0;
        });

        setStats({
          totalPodcasts: data.podcasts.length,
          totalEpisodes: totalEpCount,
          totalFollowers: totalFollowCount,
          totalPlays: Math.round(totalEpCount * 12.5) // Simulated play counts
        });
      }
    } catch (err) {
      console.error('Failed to load podcasts', err);
    } finally {
      setLoadingPodcasts(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyPodcasts();
      fetchCreatorStats();
    }
  }, [user]);

  // Handle Create Podcast Submission
  const handleCreatePodcast = async (e) => {
    e.preventDefault();
    setPError('');
    setPSuccess(false);
    setPSubmitting(true);

    const formData = new FormData();
    formData.append('title', pTitle);
    formData.append('description', pDescription);
    formData.append('category', pCategory);
    formData.append('tags', pTags);
    formData.append('language', pLanguage);
    formData.append('status', pStatus);
    if (pCover) formData.append('coverImage', pCover);
    if (pBanner) formData.append('bannerImage', pBanner);

    try {
      const res = await fetch(`${API_BASE_URL}/podcasts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setPSuccess(true);
        // Reset form
        setPTitle('');
        setPDescription('');
        setPTags('');
        setPCover(null);
        setPBanner(null);
        fetchMyPodcasts(); // Refresh list
        setTimeout(() => setActiveTab('podcasts'), 1500);
      } else {
        setPError(data.message || 'Failed to create podcast');
      }
    } catch (err) {
      setPError('Server connection failed');
    } finally {
      setPSubmitting(false);
    }
  };

  // Handle Add Episode Submission
  const handleAddEpisode = async (e) => {
    e.preventDefault();
    setEpError('');
    setEpSuccess(false);

    if (!epPodcastId) {
      setEpError('Please select a podcast');
      return;
    }
    if (!epAudio) {
      setEpError('Please upload an audio file');
      return;
    }

    setEpSubmitting(true);

    const formData = new FormData();
    formData.append('title', epTitle);
    formData.append('description', epDescription);
    formData.append('transcript', epTranscript);
    formData.append('duration', epDuration || 0);
    formData.append('status', epStatus);
    formData.append('audio', epAudio);

    try {
      const res = await fetch(`${API_BASE_URL}/podcasts/${epPodcastId}/episodes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setEpSuccess(true);
        // Reset form
        setEpTitle('');
        setEpDescription('');
        setEpTranscript('');
        setEpDuration('');
        setEpAudio(null);
        fetchMyPodcasts(); // Refresh counts
        setTimeout(() => setActiveTab('podcasts'), 1500);
      } else {
        setEpError(data.message || 'Failed to upload episode');
      }
    } catch (err) {
      setEpError('Server connection failed');
    } finally {
      setEpSubmitting(false);
    }
  };

  // Delete Podcast
  const handleDeletePodcast = async (id) => {
    if (!window.confirm('Are you sure you want to delete this podcast? All episodes will be deleted.')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/podcasts/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        fetchMyPodcasts();
      }
    } catch (err) {
      console.error('Delete podcast failed', err);
    }
  };

  return (
    <div className="creator-dashboard animate-fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h2>Creator Workspace</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Publish episodes, manage series, and track statistics.
        </p>
      </header>

      <div className="creator-layout">
        
        {/* Sidebar Navigation */}
        <aside className="creator-sidebar glass-panel">
          <p className="creator-menu-title">Control Panel</p>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`creator-menu-item ${activeTab === 'analytics' ? 'active' : ''}`}
          >
            <BarChart3 size={18} />
            <span>Analytics</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('podcasts')}
            className={`creator-menu-item ${activeTab === 'podcasts' ? 'active' : ''}`}
          >
            <Radio size={18} />
            <span>My Podcasts</span>
          </button>

          <button 
            onClick={() => setActiveTab('create-podcast')}
            className={`creator-menu-item ${activeTab === 'create-podcast' ? 'active' : ''}`}
          >
            <FolderPlus size={18} />
            <span>Create Podcast</span>
          </button>

          <button 
            onClick={() => setActiveTab('add-episode')}
            className={`creator-menu-item ${activeTab === 'add-episode' ? 'active' : ''}`}
          >
            <PlusCircle size={18} />
            <span>Add Episode</span>
          </button>

          <button 
            onClick={() => setActiveTab('record')}
            className={`creator-menu-item ${activeTab === 'record' ? 'active' : ''}`}
          >
            <Mic size={18} />
            <span>Recording Booth</span>
          </button>
        </aside>

        {/* Content Area */}
        <main className="creator-main-content">
          
          {/* TAB 1: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div>
              {loadingStats ? (
                <div className="skeleton-card glass-panel" style={{ height: '300px', borderRadius: '16px', marginBottom: '24px' }}></div>
              ) : (
                <AnalyticsCharts stats={creatorStats} />
              )}
            </div>
          )}

          {/* TAB 2: MY PODCASTS */}
          {activeTab === 'podcasts' && (
            <div>
              {loadingPodcasts ? (
                <div className="loading-grid">
                  {[1, 2].map((n) => (
                    <div key={n} className="skeleton-card glass-panel" style={{ height: '140px', borderRadius: '14px' }}></div>
                  ))}
                </div>
              ) : myPodcasts.length > 0 ? (
                <div style={{ display: 'grid', gap: '20px' }}>
                  {myPodcasts.map((podcast) => (
                    <div key={podcast._id} className="glass-panel" style={{ display: 'flex', padding: '24px', gap: '24px', borderRadius: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <img 
                          src={podcast.coverImage ? `http://localhost:5000${podcast.coverImage}` : ''} 
                          alt="Cover" 
                          style={{ width: '80px', height: '80px', borderRadius: '10px', objectFit: 'cover' }}
                        />
                        <div>
                          <h4 style={{ fontSize: '1.1rem' }}>{podcast.title}</h4>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {podcast.category} • {podcast.episodeCount} episodes • {podcast.followersCount} followers
                          </p>
                          <span style={{ 
                            display: 'inline-block', 
                            fontSize: '0.75rem', 
                            fontWeight: '600', 
                            marginTop: '8px',
                            background: podcast.status === 'published' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                            color: podcast.status === 'published' ? '#34d399' : 'var(--text-secondary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>
                            {podcast.status}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          onClick={() => {
                            setEpPodcastId(podcast._id);
                            setActiveTab('add-episode');
                          }}
                          className="btn-secondary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          <PlusCircle size={14} />
                          <span>Add Episode</span>
                        </button>
                        <button 
                          onClick={() => handleDeletePodcast(podcast._id)}
                          className="btn-secondary"
                          style={{ padding: '8px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          title="Delete Podcast"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state glass-panel">
                  <h3>No podcasts created yet</h3>
                  <p>Create a podcast show series to start adding episodes!</p>
                  <button onClick={() => setActiveTab('create-podcast')} className="btn-primary" style={{ marginTop: '16px' }}>
                    Create Podcast
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CREATE PODCAST FORM */}
          {activeTab === 'create-podcast' && (
            <div className="creator-form-panel glass-panel animate-fade-in">
              <h3 style={{ marginBottom: '24px' }}>Create Podcast Series</h3>
              
              {pError && <div className="auth-error">{pError}</div>}
              {pSuccess && <div className="auth-error" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>Podcast created successfully!</div>}

              <form onSubmit={handleCreatePodcast}>
                <div className="form-group">
                  <label className="form-label">Podcast Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Science & Society Podcast"
                    value={pTitle}
                    onChange={(e) => setPTitle(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    required
                    placeholder="Describe what your podcast show is about..."
                    value={pDescription}
                    onChange={(e) => setPDescription(e.target.value)}
                    className="form-input"
                    rows="4"
                  />
                </div>

                <div className="form-double-col">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      value={pCategory}
                      onChange={(e) => setPCategory(e.target.value)}
                      className="form-input"
                      style={{ background: 'rgba(10, 7, 30, 0.9)' }}
                    >
                      <option value="Technology">Technology</option>
                      <option value="Business">Business</option>
                      <option value="Comedy">Comedy</option>
                      <option value="Society">Society</option>
                      <option value="Music">Music</option>
                      <option value="Education">Education</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Language</label>
                    <input
                      type="text"
                      placeholder="English"
                      value={pLanguage}
                      onChange={(e) => setPLanguage(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tags (Comma separated)</label>
                  <input
                    type="text"
                    placeholder="science, society, space, debate"
                    value={pTags}
                    onChange={(e) => setPTags(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-double-col">
                  <div className="form-group">
                    <label className="form-label">Cover Image</label>
                    <div className="file-input-wrapper">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPCover(e.target.files[0])}
                        className="file-input-hidden"
                      />
                      <div className="file-input-label">
                        <Upload size={20} className="file-input-icon" />
                        <span>{pCover ? pCover.name : 'Upload JPEG/PNG (Max 5MB)'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      value={pStatus}
                      onChange={(e) => setPStatus(e.target.value)}
                      className="form-input"
                      style={{ background: 'rgba(10, 7, 30, 0.9)' }}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={pSubmitting}
                  className="btn-primary"
                  style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}
                >
                  <FolderPlus size={18} />
                  <span>{pSubmitting ? 'Creating series...' : 'Create Podcast Series'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: ADD EPISODE FORM */}
          {activeTab === 'add-episode' && (
            <div className="creator-form-panel glass-panel animate-fade-in">
              <h3 style={{ marginBottom: '24px' }}>Upload New Episode</h3>

              {epError && <div className="auth-error">{epError}</div>}
              {epSuccess && <div className="auth-error" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>Episode uploaded successfully!</div>}

              <form onSubmit={handleAddEpisode}>
                <div className="form-group">
                  <label className="form-label">Select Podcast Series</label>
                  <select
                    value={epPodcastId}
                    onChange={(e) => setEpPodcastId(e.target.value)}
                    required
                    className="form-input"
                    style={{ background: 'rgba(10, 7, 30, 0.9)' }}
                  >
                    <option value="">-- Choose Podcast --</option>
                    {myPodcasts.map((p) => (
                      <option key={p._id} value={p._id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Episode Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Episode 1: Space Exploration"
                    value={epTitle}
                    onChange={(e) => setEpTitle(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    required
                    placeholder="Write a brief overview of this episode..."
                    value={epDescription}
                    onChange={(e) => setEpDescription(e.target.value)}
                    className="form-input"
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Transcript / Synced Subtitles (Optional)</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Format: [MM:SS] Subtitle Text</span>
                  </label>
                  <textarea
                    placeholder="e.g.&#10;[00:00] Intro music plays&#10;[00:05] Host: Welcome back to the show!&#10;[00:10] Today we talk about space exploration."
                    value={epTranscript}
                    onChange={(e) => setEpTranscript(e.target.value)}
                    className="form-input"
                    rows="4"
                  />
                </div>

                <div className="form-double-col">
                  <div className="form-group">
                    <label className="form-label">Duration (in seconds)</label>
                    <input
                      type="number"
                      placeholder="e.g. 1800 (for 30 minutes)"
                      value={epDuration}
                      onChange={(e) => setEpDuration(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      value={epStatus}
                      onChange={(e) => setEpStatus(e.target.value)}
                      className="form-input"
                      style={{ background: 'rgba(10, 7, 30, 0.9)' }}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Upload Audio File (MP3)</label>
                  <div className="file-input-wrapper" style={{ padding: '30px' }}>
                    <input
                      type="file"
                      accept="audio/mp3,audio/mpeg"
                      required
                      onChange={(e) => setEpAudio(e.target.files[0])}
                      className="file-input-hidden"
                    />
                    <div className="file-input-label">
                      <FileAudio size={24} className="file-input-icon" />
                      <span>{epAudio ? epAudio.name : 'Upload MP3 (Max 100MB)'}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={epSubmitting}
                  className="btn-primary"
                  style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}
                >
                  <Upload size={18} />
                  <span>{epSubmitting ? 'Uploading episode...' : 'Publish Episode'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 5: RECORDING BOOTH */}
          {activeTab === 'record' && (
            <RecordingBooth />
          )}

        </main>
      </div>
    </div>
  );
}
