import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { 
  BarChart3, PlusCircle, Radio, FolderPlus, 
  Trash2, Upload, FileAudio, Users, Layers, Play, Mic, Edit
} from 'lucide-react';
import AnalyticsCharts from '../components/AnalyticsCharts';
import RecordingBooth from '../components/RecordingBooth';
import './Pages.css';

export default function CreatorDashboard() {
  const { token, getAuthHeaders, user } = useAuth();
  
  // State
  const [activeTab, setActiveTab] = useState('analytics'); // analytics, podcasts, create-podcast, add-episode
  const [notification, setNotification] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };
  const [myPodcasts, setMyPodcasts] = useState([]);
  const [loadingPodcasts, setLoadingPodcasts] = useState(true);

  // Edit Podcast states
  const [editingPodcast, setEditingPodcast] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [editStatus, setEditStatus] = useState('published');
  const [editCoverFile, setEditCoverFile] = useState(null);
  const [editCoverPreview, setEditCoverPreview] = useState('');
  const [editBannerFile, setEditBannerFile] = useState(null);
  const [editBannerPreview, setEditBannerPreview] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const handleStartEditPodcast = (podcast) => {
    setEditingPodcast(podcast);
    setEditTitle(podcast.title || '');
    setEditDescription(podcast.description || '');
    setEditCategory(podcast.category || '');
    setEditTags((podcast.tags || []).join(', '));
    setEditLanguage(podcast.language || 'English');
    setEditStatus(podcast.status || 'published');
    setEditCoverFile(null);
    setEditCoverPreview(podcast.coverImage ? window.getMediaUrl(podcast.coverImage) : '');
    setEditBannerFile(null);
    setEditBannerPreview(podcast.bannerImage ? window.getMediaUrl(podcast.bannerImage) : '');
  };

  const handleUpdatePodcast = async (e) => {
    e.preventDefault();
    if (!editTitle.trim() || !editDescription.trim() || !editCategory) {
      showNotification('Title, description and category are required', 'error');
      return;
    }

    setEditSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', editTitle.trim());
      formData.append('description', editDescription.trim());
      formData.append('category', editCategory);
      formData.append('language', editLanguage);
      formData.append('status', editStatus);
      formData.append('tags', editTags);

      if (editCoverFile) {
        formData.append('coverImage', editCoverFile);
      }
      if (editBannerFile) {
        formData.append('bannerImage', editBannerFile);
      }

      const res = await fetch(`${API_BASE_URL}/podcasts/${editingPodcast._id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        showNotification('Podcast updated successfully!');
        setEditingPodcast(null);
        fetchPodcasts();
      } else {
        showNotification(data.message || 'Failed to update podcast', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Error updating podcast', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

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

  // Drafts states
  const [draftEpisodes, setDraftEpisodes] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

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

  const fetchDraftEpisodes = async () => {
    if (myPodcasts.length === 0) return;
    setLoadingDrafts(true);
    try {
      const allDrafts = [];
      for (const podcast of myPodcasts) {
        const res = await fetch(`${API_BASE_URL}/podcasts/${podcast._id}/episodes`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success) {
          const drafts = data.episodes.filter(ep => ep.status === 'draft').map(ep => ({
            ...ep,
            podcastTitle: podcast.title
          }));
          allDrafts.push(...drafts);
        }
      }
      setDraftEpisodes(allDrafts);
    } catch (err) {
      console.error('Failed to fetch draft episodes', err);
    } finally {
      setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'drafts') {
      fetchDraftEpisodes();
    }
  }, [activeTab, myPodcasts]);

  const handlePublishEpisode = (id) => {
    setConfirmModal({
      title: 'Publish Episode?',
      message: 'Are you sure you want to publish this episode and notify your followers?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/episodes/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'published' })
          });
          const data = await res.json();
          if (data.success) {
            showNotification('Episode published successfully!');
            fetchDraftEpisodes();
            fetchMyPodcasts();
          } else {
            showNotification(data.message || 'Failed to publish episode', 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Failed to publish episode', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

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
  const handleDeletePodcast = (id) => {
    setConfirmModal({
      title: 'Delete Podcast?',
      message: 'Are you sure you want to delete this podcast? All episodes will be deleted.',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/podcasts/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });
          const data = await res.json();
          if (data.success) {
            showNotification('Podcast deleted successfully');
            fetchMyPodcasts();
          } else {
            showNotification(data.message || 'Failed to delete podcast', 'error');
          }
        } catch (err) {
          console.error('Delete podcast failed', err);
          showNotification('Failed to delete podcast', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  // Publish Podcast
  const handlePublishPodcast = (id) => {
    setConfirmModal({
      title: 'Publish Podcast?',
      message: 'Are you sure you want to make this podcast show live and visible to all listeners?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/podcasts/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'published' })
          });
          const data = await res.json();
          if (data.success) {
            showNotification('Podcast published successfully! It is now visible to all listeners.');
            fetchMyPodcasts();
          } else {
            showNotification(data.message || 'Failed to publish podcast', 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Failed to publish podcast', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
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

          <button 
            onClick={() => setActiveTab('drafts')}
            className={`creator-menu-item ${activeTab === 'drafts' ? 'active' : ''}`}
          >
            <Layers size={18} />
            <span>Drafts Workspace</span>
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
                          src={podcast.coverImage ? window.getMediaUrl(podcast.coverImage) : ''} 
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

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {podcast.status === 'draft' && (
                          <button 
                            onClick={() => handlePublishPodcast(podcast._id)}
                            className="btn-primary"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <span>Publish Show</span>
                          </button>
                        )}
                        <button 
                          onClick={() => handleStartEditPodcast(podcast)}
                          className="btn-secondary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          <Edit size={14} />
                          <span>Edit Show</span>
                        </button>
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
                      style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
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
                      style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
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
                    style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
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
                      style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
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

          {/* TAB 6: DRAFTS WORKSPACE */}
          {activeTab === 'drafts' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              {/* Draft Podcasts */}
              <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px' }}>
                <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Radio size={20} style={{ color: 'var(--color-primary)' }} />
                  <span>Podcast Show Drafts</span>
                </h3>
                
                {myPodcasts.filter(p => p.status === 'draft').length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No podcast drafts found. All your shows are published!</p>
                ) : (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {myPodcasts.filter(p => p.status === 'draft').map((podcast) => (
                      <div key={podcast._id} className="glass-panel" style={{ display: 'flex', padding: '20px', gap: '20px', borderRadius: '12px', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <img 
                            src={podcast.coverImage ? window.getMediaUrl(podcast.coverImage) : ''} 
                            alt="Cover" 
                            style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }}
                          />
                          <div>
                            <h4 style={{ fontSize: '1rem', margin: 0 }}>{podcast.title}</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                              {podcast.category} • Created as draft
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handlePublishPodcast(podcast._id)}
                          className="btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          Publish Show
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Draft Episodes */}
              <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px' }}>
                <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileAudio size={20} style={{ color: 'var(--color-primary)' }} />
                  <span>Episode Drafts</span>
                </h3>

                {loadingDrafts ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading draft episodes...</p>
                ) : draftEpisodes.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No episode drafts found. All uploaded episodes are published!</p>
                ) : (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {draftEpisodes.map((episode) => (
                      <div key={episode._id} className="glass-panel" style={{ display: 'flex', padding: '20px', gap: '20px', borderRadius: '12px', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', minWidth: 0, flexGrow: 1 }}>
                          <FileAudio size={32} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <h4 style={{ fontSize: '1rem', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{episode.title}</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                              Show: <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{episode.podcastTitle}</span> • Duration: {Math.round(episode.duration / 60)} min
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handlePublishEpisode(episode._id)}
                          className="btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem', flexShrink: 0 }}
                        >
                          Publish Episode
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </main>
      </div>

      {/* Custom Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)',
          backdropFilter: 'blur(8px)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '12px',
          border: `1px solid ${notification.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{notification.message}</span>
        </div>
      )}

      {/* Edit Podcast Modal */}
      {editingPodcast && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <form onSubmit={handleUpdatePodcast} className="glass-panel animate-scale-in" style={{
            padding: '32px',
            borderRadius: '20px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            position: 'relative'
          }}>
            <button 
              type="button"
              onClick={() => setEditingPodcast(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255,255,255,0.05)',
                border: 0,
                color: 'var(--text-primary)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>

            <h3 style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', fontSize: '1.2rem' }}>Edit Podcast Show</h3>

            <div className="form-group">
              <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Show Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Description</label>
              <textarea
                required
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="form-input"
                rows="3"
              />
            </div>

            <div className="form-double-col">
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="form-input"
                  style={{ background: 'var(--bg-card)' }}
                >
                  <option value="Technology">Technology</option>
                  <option value="Business">Business</option>
                  <option value="Education">Education</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="News">News</option>
                  <option value="Comedy">Comedy</option>
                  <option value="Society">Society</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Language</label>
                <input
                  type="text"
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-double-col">
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="tech, future, design"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Publishing Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="form-input"
                  style={{ background: 'var(--bg-card)' }}
                >
                  <option value="draft">Draft Show</option>
                  <option value="published">Published (Public)</option>
                </select>
              </div>
            </div>

            {/* File Upload Grids */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cover Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setEditCoverFile(file);
                      setEditCoverPreview(URL.createObjectURL(file));
                    }
                  }}
                  className="form-input"
                  style={{ fontSize: '0.75rem' }}
                />
                {editCoverPreview && (
                  <img src={editCoverPreview} alt="Cover Preview" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', marginTop: '8px', border: '1px solid var(--border-color)' }} />
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Banner Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setEditBannerFile(file);
                      setEditBannerPreview(URL.createObjectURL(file));
                    }
                  }}
                  className="form-input"
                  style={{ fontSize: '0.75rem' }}
                />
                {editBannerPreview && (
                  <img src={editBannerPreview} alt="Banner Preview" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', marginTop: '8px', border: '1px solid var(--border-color)' }} />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setEditingPodcast(null)}
                style={{ padding: '8px 20px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={editSubmitting}
                className="btn-primary" 
                style={{ padding: '8px 24px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && (
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
          zIndex: 99999,
        }}>
          <div className="glass-panel animate-scale-in" style={{
            padding: '28px',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '1.2rem' }}>{confirmModal.title}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setConfirmModal(null)}
                className="btn-secondary" 
                style={{ padding: '8px 20px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="btn-primary" 
                style={{ padding: '8px 20px', borderRadius: '50px', background: '#9333ea', borderColor: '#9333ea', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
