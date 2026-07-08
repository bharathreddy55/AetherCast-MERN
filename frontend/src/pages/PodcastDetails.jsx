import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { Disc, Play, Bookmark, BookmarkCheck, Calendar, Clock, Music, MessageSquare, Star, FolderPlus, Download, Check, Loader2, Heart, Share2 } from 'lucide-react';
import CommentsSection from '../components/CommentsSection';
import RatingWidget from '../components/RatingWidget';
import TranscriptEditorModal from '../components/TranscriptEditorModal';
import './Pages.css';

export default function PodcastDetails() {
  const { id } = useParams();
  const { token, getAuthHeaders, user } = useAuth();
  const { playEpisode, currentEpisode, isPlaying } = usePlayer();

  const [podcast, setPodcast] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [activeCommentsEpisode, setActiveCommentsEpisode] = useState(null);
  const [activeEditTranscriptEpisode, setActiveEditTranscriptEpisode] = useState(null);

  // Edit podcast modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [editStatus, setEditStatus] = useState('published');
  const [editCoverFile, setEditCoverFile] = useState(null);
  const [editBannerFile, setEditBannerFile] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Offline caching states
  const [downloadedIds, setDownloadedIds] = useState([]);
  const [downloadingMap, setDownloadingMap] = useState({});

  // Like states
  const [likedMap, setLikedMap] = useState({});
  const [likesCountMap, setLikesCountMap] = useState({});

  // AI states
  const [loadingAI, setLoadingAI] = useState({});

  const handleGenerateAIFeatures = async (episodeId) => {
    setLoadingAI(prev => ({ ...prev, [episodeId]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/episodes/${episodeId}/ai-features`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setEpisodes(prev => prev.map(ep => {
          if (ep._id === episodeId) {
            return { ...ep, aiSummary: data.aiSummary, aiTags: data.aiTags };
          }
          return ep;
        }));
      } else {
        alert(data.message || 'Failed to generate AI features');
      }
    } catch (err) {
      console.error(err);
      alert('Error generating AI features');
    } finally {
      setLoadingAI(prev => ({ ...prev, [episodeId]: false }));
    }
  };

  useEffect(() => {
    const checkDownloads = () => {
      const saved = JSON.parse(localStorage.getItem('downloads') || '[]');
      setDownloadedIds(saved.map(item => item._id));
    };
    checkDownloads();
  }, []);

  const downloadEpisode = async (episode) => {
    try {
      setDownloadingMap(prev => ({ ...prev, [episode._id]: 'downloading' }));
      const audioUrl = episode.audioUrl;
      const url = audioUrl.startsWith('http') ? audioUrl : `${window.BACKEND_URL}${audioUrl}`;

      const cache = await caches.open('vox-audio-v1');
      await cache.add(url);

      const saved = JSON.parse(localStorage.getItem('downloads') || '[]');
      if (!saved.some(item => item._id === episode._id)) {
        saved.push(episode);
        localStorage.setItem('downloads', JSON.stringify(saved));
      }

      setDownloadedIds(prev => [...prev, episode._id]);
      setDownloadingMap(prev => ({ ...prev, [episode._id]: 'done' }));
    } catch (err) {
      console.error('Failed to download episode', err);
      setDownloadingMap(prev => ({ ...prev, [episode._id]: 'error' }));
    }
  };

  const deleteDownload = async (episode) => {
    try {
      const audioUrl = episode.audioUrl;
      const url = audioUrl.startsWith('http') ? audioUrl : `${window.BACKEND_URL}${audioUrl}`;
      const cache = await caches.open('vox-audio-v1');
      await cache.delete(url);

      const saved = JSON.parse(localStorage.getItem('downloads') || '[]');
      const filtered = saved.filter(item => item._id !== episode._id);
      localStorage.setItem('downloads', JSON.stringify(filtered));

      setDownloadedIds(prev => prev.filter(id => id !== episode._id));
      setDownloadingMap(prev => {
        const copy = { ...prev };
        delete copy[episode._id];
        return copy;
      });
    } catch (err) {
      console.error('Failed to delete download', err);
    }
  };

  const fetchDetails = async () => {
    try {
      // Fetch podcast
      const res = await fetch(`${API_BASE_URL}/podcasts/${id}`);
      const data = await res.json();
      if (data.success) {
        setPodcast(data.podcast);
      }

      // Fetch episodes
      const epRes = await fetch(`${API_BASE_URL}/podcasts/${id}/episodes`);
      const epData = await epRes.json();
      if (epData.success) {
        setEpisodes(epData.episodes);
      }

      // Check follow status if logged in
      if (token) {
        const followRes = await fetch(`${API_BASE_URL}/podcasts/${id}/follow-status`, {
          headers: getAuthHeaders(),
        });
        const followData = await followRes.json();
        if (followData.success) {
          setFollowing(followData.following);
        }

        // Fetch playlists
        const playlistsRes = await fetch(`${API_BASE_URL}/playlists`, {
          headers: getAuthHeaders(),
        });
        const playlistsData = await playlistsRes.json();
        if (playlistsData.success) {
          setPlaylists(playlistsData.playlists);
        }
      }
    } catch (err) {
      console.error('Failed to load podcast details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id, token]);

  useEffect(() => {
    if (podcast) {
      setEditTitle(podcast.title || '');
      setEditDesc(podcast.description || '');
      setEditCategory(podcast.category || 'other');
      setEditLanguage(podcast.language || 'English');
      setEditStatus(podcast.status || 'published');
    }
  }, [podcast]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('description', editDesc);
      formData.append('category', editCategory);
      formData.append('language', editLanguage);
      formData.append('status', editStatus);
      if (editCoverFile) {
        formData.append('coverImage', editCoverFile);
      }
      if (editBannerFile) {
        formData.append('bannerImage', editBannerFile);
      }

      const res = await fetch(`${API_BASE_URL}/podcasts/${podcast._id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        setPodcast(data.podcast);
        setShowEditModal(false);
      } else {
        setErrorMsg(data.message || 'Failed to update podcast');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error occurred while updating.');
    } finally {
      setUpdating(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!token) return; // User needs to login
    setLoadingFollow(true);
    try {
      const endpoint = following ? 'unfollow' : 'follow';
      const res = await fetch(`${API_BASE_URL}/podcasts/${podcast._id}/${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setFollowing(!following);
        // Refresh followers count
        setPodcast((prev) => ({
          ...prev,
          followersCount: following ? Math.max(0, prev.followersCount - 1) : prev.followersCount + 1,
        }));
      }
    } catch (err) {
      console.error('Follow toggle error', err);
    } finally {
      setLoadingFollow(false);
    }
  };

  const handleAddToPlaylist = async (playlistId, episodeId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/playlists/${playlistId}/episodes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ episodeId }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Added to playlist successfully!');
      } else {
        alert(data.message || 'Already added');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs} min`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="details-page animate-fade-in">
        <div className="skeleton-card glass-panel" style={{ height: '300px', borderRadius: '20px' }}></div>
      </div>
    );
  }

  if (!podcast) {
    return (
      <div className="details-page animate-fade-in" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h3>Podcast not found</h3>
        <Link to="/explore" className="btn-primary" style={{ marginTop: '16px' }}>Go Back</Link>
      </div>
    );
  }

  // Filter out drafts unless the current user is the owner/admin
  const publishedEpisodes = episodes.filter(
    (ep) => ep.status === 'published' || (user && (user.role === 'admin' || user.id === podcast.creatorId?._id))
  );

  const getCoverImage = () => {
    if (!podcast) return '';
    if (podcast.coverImage) {
      return window.getMediaUrl(podcast.coverImage);
    }
    const cat = (podcast.category || '').toLowerCase();
    if (cat.includes('tech')) {
      return window.getMediaUrl('/uploads/defaults/tech_cover.jpg');
    }
    if (cat.includes('bus') || cat.includes('fin')) {
      return window.getMediaUrl('/uploads/defaults/business_cover.jpg');
    }
    if (cat.includes('edu') || cat.includes('science')) {
      return window.getMediaUrl('/uploads/defaults/education_cover.jpg');
    }
    if (cat.includes('entertain') || cat.includes('show') || cat.includes('comedy')) {
      return window.getMediaUrl('/uploads/defaults/entertainment_cover.jpg');
    }
    return window.getMediaUrl('/uploads/defaults/default_cover.jpg');
  };

  return (
    <>
      <div className="details-page animate-fade-in">
      {/* Podcast Banner/Header */}
      <header className="details-header glass-panel">
        <img src={getCoverImage()} alt={podcast.title} className="details-cover" />

        <div className="details-info">
          <span className="details-badge">{podcast.category}</span>
          <h1 className="details-title">{podcast.title}</h1>
          <p className="details-creator">
            Created by <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{podcast.creatorId?.name}</span> • {podcast.followersCount} followers
          </p>
          <p className="details-desc">{podcast.description}</p>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '0.9rem', fontWeight: '600' }}>
              <Star size={16} fill="#fbbf24" />
              {podcast.ratingAverage > 0 ? `${podcast.ratingAverage.toFixed(1)}/5.0` : 'No ratings'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ({podcast.ratingCount || 0} reviews)
            </span>
          </div>

          <div className="details-actions" style={{ marginTop: '20px' }}>
            {user && user.id === podcast.creatorId?._id ? (
              <button 
                onClick={() => setShowEditModal(true)} 
                className="btn-primary"
              >
                <span>Edit Podcast Info</span>
              </button>
            ) : (
              token && (
                <button 
                  onClick={handleFollowToggle} 
                  disabled={loadingFollow}
                  className="btn-secondary"
                >
                  {following ? <BookmarkCheck size={18} className="gradient-text" /> : <Bookmark size={18} />}
                  <span>{following ? 'Following' : 'Follow Show'}</span>
                </button>
              )
            )}
            {!token && (
              <Link to="/login" className="btn-secondary">
                <Bookmark size={18} />
                <span>Log in to Follow</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Episodes List */}
      <section className="episodes-list-section">
        <h2>Episodes ({publishedEpisodes.length})</h2>

        {publishedEpisodes.length > 0 ? (
          <div>
            {publishedEpisodes.map((ep) => {
              const isCurrent = currentEpisode && currentEpisode._id === ep._id;
              const commentsOpen = activeCommentsEpisode === ep._id;
              
              // Ensure we inject the podcast detail cover into the episode object for player UI
              const episodeForPlayer = {
                ...ep,
                podcastId: {
                  _id: podcast._id,
                  title: podcast.title,
                  coverImage: podcast.coverImage,
                }
              };

              const isCreator = user && (
                user.role === 'admin' || 
                user.id === podcast.creatorId?._id || 
                user._id === podcast.creatorId?._id || 
                user.id === podcast.creatorId || 
                user._id === podcast.creatorId
              );

              return (
                <div key={ep._id} style={{ marginBottom: '16px' }}>
                  <div className="episode-row glass-panel">
                    <div className="episode-row-left">
                      <button 
                        onClick={() => playEpisode(episodeForPlayer, publishedEpisodes.map(e => ({
                          ...e,
                          podcastId: {
                            _id: podcast._id,
                            title: podcast.title,
                            coverImage: podcast.coverImage,
                          }
                        })))}
                        className="play-row-btn"
                      >
                        <Play size={16} fill={isCurrent && isPlaying ? 'currentColor' : 'none'} />
                      </button>
                      <div className="episode-meta-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h4 className="episode-row-title" style={{ color: isCurrent ? 'var(--color-primary)' : 'var(--text-primary)', margin: 0 }}>
                          {ep.title}
                        </h4>
                        <p className="episode-row-desc" style={{ margin: 0 }}>{ep.description}</p>
                        
                        {/* AI Summary Block */}
                        {ep.aiSummary && (
                          <p style={{ 
                            fontSize: '0.8rem', 
                            color: 'var(--text-secondary)', 
                            background: 'rgba(255,255,255,0.03)', 
                            padding: '8px 12px', 
                            borderRadius: '8px', 
                            borderLeft: '2px solid #06b6d4',
                            margin: '4px 0 0 0',
                            lineHeight: '1.4'
                          }}>
                            <span style={{ color: '#06b6d4', fontWeight: '600', marginRight: '6px' }}>✨ AI Summary:</span>
                            {ep.aiSummary}
                          </p>
                        )}

                        {/* AI Tags & Actions */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
                          {ep.aiTags && ep.aiTags.map(tag => (
                            <span key={tag} style={{ 
                              fontSize: '0.7rem', 
                              background: 'rgba(6, 182, 212, 0.1)', 
                              color: '#06b6d4', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              border: '1px solid rgba(6, 182, 212, 0.2)' 
                            }}>
                              #{tag}
                            </span>
                          ))}

                          {isCreator && (
                            <button
                              onClick={() => handleGenerateAIFeatures(ep._id)}
                              disabled={loadingAI[ep._id]}
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {loadingAI[ep._id] ? <Loader2 size={10} className="animate-spin" /> : '✨ AI Summarize'}
                            </button>
                          )}

                          {(isCreator || (user && user.role === 'admin')) && (
                            <button
                              onClick={() => setActiveEditTranscriptEpisode(ep)}
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              📝 Edit Subtitles
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="episode-row-right">
                      {token && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FolderPlus size={14} className="aux-icon" style={{ color: 'var(--text-secondary)' }} />
                          <select
                            onChange={async (e) => {
                              const val = e.target.value;
                              if (val === 'new') {
                                const playlistName = window.prompt('Enter name for the new playlist:');
                                if (!playlistName || !playlistName.trim()) {
                                  e.target.value = '';
                                  return;
                                }
                                try {
                                  const createRes = await fetch(`${API_BASE_URL}/playlists`, {
                                    method: 'POST',
                                    headers: getAuthHeaders(),
                                    body: JSON.stringify({ name: playlistName.trim() }),
                                  });
                                  const createData = await createRes.json();
                                  if (createData.success) {
                                    const refreshedRes = await fetch(`${API_BASE_URL}/playlists`, {
                                      headers: getAuthHeaders(),
                                    });
                                    const refreshedData = await refreshedRes.json();
                                    if (refreshedData.success) {
                                      setPlaylists(refreshedData.playlists);
                                    }
                                    await handleAddToPlaylist(createData.playlist._id, ep._id);
                                  } else {
                                    alert(createData.message || 'Failed to create playlist');
                                  }
                                } catch (err) {
                                  console.error(err);
                                }
                              } else if (val) {
                                handleAddToPlaylist(val, ep._id);
                              }
                              e.target.value = '';
                            }}
                            className="speed-dropdown"
                            style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                          >
                            <option value="">Add to Playlist...</option>
                            {playlists.map((pl) => (
                              <option key={pl._id} value={pl._id}>{pl.name}</option>
                            ))}
                            <option value="new">➕ Create New Playlist...</option>
                          </select>
                        </div>
                      )}

                      <button
                        onClick={() => setActiveCommentsEpisode(commentsOpen ? null : ep._id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', color: commentsOpen ? 'var(--color-secondary)' : 'var(--text-muted)' }}
                      >
                        <MessageSquare size={16} />
                      </button>

                      {token && (
                        <button
                          onClick={() => {
                            const isDownloaded = downloadedIds.includes(ep._id);
                            if (isDownloaded) {
                              deleteDownload(ep);
                            } else {
                              downloadEpisode(episodeForPlayer);
                            }
                          }}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            color: downloadedIds.includes(ep._id) ? '#10b981' : (downloadingMap[ep._id] === 'downloading' ? 'var(--color-secondary)' : 'var(--text-muted)'),
                            background: 'transparent',
                            border: 0,
                            cursor: downloadingMap[ep._id] === 'downloading' ? 'default' : 'pointer'
                          }}
                          title={downloadedIds.includes(ep._id) ? "Delete Download" : "Download Episode"}
                          disabled={downloadingMap[ep._id] === 'downloading'}
                        >
                          {downloadingMap[ep._id] === 'downloading' ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : downloadedIds.includes(ep._id) ? (
                            <Check size={16} />
                          ) : (
                            <Download size={16} />
                          )}
                        </button>
                      )}

                      {/* Like Button */}
                      {token && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`${API_BASE_URL}/episodes/${ep._id}/like`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              const data = await res.json();
                              if (data.success) {
                                setLikedMap(prev => ({ ...prev, [ep._id]: data.liked }));
                                setLikesCountMap(prev => ({ ...prev, [ep._id]: data.likesCount }));
                              }
                            } catch (err) { console.error(err); }
                          }}
                          title={likedMap[ep._id] ? 'Unlike' : 'Like'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            color: likedMap[ep._id] ? '#ef4444' : 'var(--text-muted)',
                            background: 'transparent', border: 0, cursor: 'pointer', fontSize: '0.75rem',
                          }}
                        >
                          <Heart size={16} fill={likedMap[ep._id] ? '#ef4444' : 'none'} />
                          {likesCountMap[ep._id] || ep.likedBy?.length || 0}
                        </button>
                      )}

                      {/* Share Button */}
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/podcast/${podcast._id}`;
                          if (navigator.share) {
                            navigator.share({ title: ep.title, text: `Listen to "${ep.title}" on VOX!`, url }).catch(() => {});
                          } else {
                            navigator.clipboard.writeText(url);
                            alert('Link copied to clipboard!');
                          }
                        }}
                        title="Share"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', background: 'transparent', border: 0, cursor: 'pointer' }}
                      >
                        <Share2 size={16} />
                      </button>

                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        {formatDate(ep.publishDate)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} />
                        {formatDuration(ep.duration)}
                      </span>
                      {ep.status === 'draft' && (
                        <span style={{ color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>
                          DRAFT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Discussion Panel */}
                  {commentsOpen && (
                    <div style={{ marginTop: '8px', paddingLeft: '40px' }} className="animate-fade-in">
                      <CommentsSection episodeId={ep._id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state glass-panel">
            <Music size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h3>No episodes published yet</h3>
            <p>Check back later or follow the creator for updates.</p>
          </div>
        )}
      </section>

      {/* Ratings & Reviews Section */}
      <RatingWidget podcastId={podcast._id} onChange={fetchDetails} />
      </div>

      {activeEditTranscriptEpisode && (
        <TranscriptEditorModal
          episode={activeEditTranscriptEpisode}
          token={token}
          onClose={() => setActiveEditTranscriptEpisode(null)}
          onSaveSuccess={(newTranscript) => {
            // Update transcript in local episodes list state
            setEpisodes(prev => prev.map(ep => {
              if (ep._id === activeEditTranscriptEpisode._id) {
                return { ...ep, transcript: newTranscript };
              }
              return ep;
            }));
          }}
        />
      )}
      {/* Edit Podcast Modal Overlay */}
      {showEditModal && (
        <div className="simulation-overlay animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div className="simulation-modal glass-panel animate-scale-up" style={{ width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Edit Broadcast Show</h3>
            
            {errorMsg && (
              <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.85rem' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Podcast Title</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Description</label>
                <textarea 
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows="4"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Category</label>
                  <select 
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="technology">Technology</option>
                    <option value="business">Business</option>
                    <option value="education">Education</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Language</label>
                  <input 
                    type="text" 
                    value={editLanguage}
                    onChange={(e) => setEditLanguage(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Publishing Status</label>
                <select 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Cover Image</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setEditCoverFile(e.target.files[0])}
                    style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                  />
                </div>

                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Banner Image</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setEditBannerFile(e.target.files[0])}
                    style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={updating}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={updating}
                  style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {updating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
