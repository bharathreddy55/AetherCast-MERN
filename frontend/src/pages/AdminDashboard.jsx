import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Users, Radio, ShieldAlert, Award, Star, MessageSquare, Trash2, Eye, RefreshCw, Search, Music } from 'lucide-react';
import './Pages.css';

export default function AdminDashboard() {
  const { token, user } = useAuth();
  
  // Custom Alerts & Confirms States
  const [notification, setNotification] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // User Management
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Moderation List
  const [flaggedComments, setFlaggedComments] = useState([]);
  const [flaggedReviews, setFlaggedReviews] = useState([]);
  const [loadingFlagged, setLoadingFlagged] = useState(true);

  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState('stats'); // 'stats', 'users', 'moderation', 'podcasts', 'episodes'

  // Podcast / Episode lists
  const [podcastsList, setPodcastsList] = useState([]);
  const [loadingPodcasts, setLoadingPodcasts] = useState(true);
  const [episodesList, setEpisodesList] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);

  // Global Comments CRUD
  const [commentsList, setCommentsList] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentsSearch, setCommentsSearch] = useState('');

  // User Details Modal
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);

  useEffect(() => {
    if (activeSubTab === 'stats') {
      fetchStats();
    } else if (activeSubTab === 'users') {
      fetchUsers();
    } else if (activeSubTab === 'moderation') {
      fetchFlagged();
    } else if (activeSubTab === 'podcasts') {
      fetchPodcasts();
    } else if (activeSubTab === 'episodes') {
      fetchEpisodes();
    } else if (activeSubTab === 'comments') {
      fetchComments(commentsSearch);
    }
  }, [activeSubTab, userPage, userRoleFilter, userStatusFilter]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      let url = `${API_BASE_URL}/admin/users?page=${userPage}&limit=8`;
      if (userSearch) url += `&search=${encodeURIComponent(userSearch)}`;
      if (userRoleFilter) url += `&role=${userRoleFilter}`;
      if (userStatusFilter) url += `&status=${userStatusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsersList(data.users);
        setUserTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchFlagged = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/flagged`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setFlaggedComments(data.comments);
        setFlaggedReviews(data.reviews);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFlagged(false);
    }
  };

  const fetchPodcasts = async () => {
    setLoadingPodcasts(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/podcasts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setPodcastsList(data.podcasts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPodcasts(false);
    }
  };

  const fetchEpisodes = async () => {
    setLoadingEpisodes(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/episodes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setEpisodesList(data.episodes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const fetchComments = async (searchVal = '') => {
    setLoadingComments(true);
    try {
      const url = `${API_BASE_URL}/admin/comments${searchVal ? `?search=${encodeURIComponent(searchVal)}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setCommentsList(data.comments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments(false);
    }
  };

  const fetchUserDetails = async (userId) => {
    setLoadingUserDetail(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedUserDetail(data);
      } else {
        showNotification(data.message, 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Failed to fetch user details', 'error');
    } finally {
      setLoadingUserDetail(false);
    }
  };

  const handleDeletePodcast = (podcastId) => {
    setConfirmModal({
      title: "Delete Podcast?",
      message: "Are you sure you want to permanently delete this podcast and all its episodes? This cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/admin/podcasts/${podcastId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            showNotification(data.message);
            setPodcastsList(prev => prev.filter(p => p._id !== podcastId));
          } else {
            showNotification(data.message, 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Failed to delete podcast', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDeleteEpisode = (episodeId) => {
    setConfirmModal({
      title: "Delete Episode?",
      message: "Are you sure you want to permanently delete this episode? This cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/admin/episodes/${episodeId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            showNotification(data.message);
            setEpisodesList(prev => prev.filter(e => e._id !== episodeId));
          } else {
            showNotification(data.message, 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Failed to delete episode', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDeleteUser = (userId) => {
    setConfirmModal({
      title: "Delete User?",
      message: "Are you sure you want to permanently delete this user's profile from MongoDB? This cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            showNotification(data.message);
            fetchUsers();
            fetchStats();
          } else {
            showNotification(data.message, 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Failed to delete user', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleToggleUserStatus = (userId) => {
    setConfirmModal({
      title: "Change Account Status?",
      message: "Change status of this user's account (Suspend/Activate)?",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            showNotification(data.message);
            fetchUsers();
            fetchStats();
          } else {
            showNotification(data.message, 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Failed to update status', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleChangeUserRole = (userId, newRole) => {
    setConfirmModal({
      title: "Update User Role?",
      message: `Are you sure you want to change this user's role to "${newRole.toUpperCase()}"?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ role: newRole })
          });
          const data = await res.json();
          if (data.success) {
            showNotification(data.message);
            fetchUsers();
            fetchStats();
          } else {
            showNotification(data.message, 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Failed to update role', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDeleteComment = (commentId) => {
    setConfirmModal({
      title: "Delete Comment?",
      message: "Delete this comment permanently?",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/admin/comments/${commentId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            showNotification('Comment deleted successfully');
            setFlaggedComments(prev => prev.filter(c => c._id !== commentId));
            fetchStats();
          } else {
            showNotification(data.message, 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Failed to delete comment', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDeleteCommentGlobal = (commentId) => {
    setConfirmModal({
      title: "Delete Comment?",
      message: "Are you sure you want to permanently delete this comment? This cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/admin/comments/${commentId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            showNotification('Comment deleted successfully');
            setCommentsList(prev => prev.filter(c => c._id !== commentId));
            setFlaggedComments(prev => prev.filter(c => c._id !== commentId));
            fetchStats();
          } else {
            showNotification(data.message, 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Failed to delete comment', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDismissComment = async (commentId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/comments/${commentId}/dismiss`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Flag dismissed');
        setFlaggedComments(prev => prev.filter(c => c._id !== commentId));
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReview = (reviewId) => {
    setConfirmModal({
      title: "Delete Review?",
      message: "Delete this review permanently?",
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/admin/reviews/${reviewId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
            showNotification('Review deleted successfully');
            setFlaggedReviews(prev => prev.filter(r => r._id !== reviewId));
            fetchStats();
          } else {
            showNotification(data.message, 'error');
          }
        } catch (err) {
          console.error(err);
          showNotification('Failed to delete review', 'error');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDismissReview = async (reviewId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reviews/${reviewId}/dismiss`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Flag dismissed');
        setFlaggedReviews(prev => prev.filter(r => r._id !== reviewId));
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-container animate-fade-in" style={{ padding: '80px 20px 140px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2>Moderation Command Center</h2>
          <p style={{ color: 'var(--text-secondary)' }}>System governance, user accounts administration, and flagged comment/reviews filters.</p>
        </div>
        <button onClick={() => { fetchStats(); fetchUsers(); fetchFlagged(); }} className="btn-secondary" style={{ padding: '8px' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Admin Nav Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        <button
          onClick={() => setActiveSubTab('stats')}
          className={activeSubTab === 'stats' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '50px', fontSize: '0.85rem' }}
        >
          <Award size={16} />
          Metrics Overview
        </button>
        <button
          onClick={() => setActiveSubTab('users')}
          className={activeSubTab === 'users' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '50px', fontSize: '0.85rem' }}
        >
          <Users size={16} />
          User Accounts
        </button>
        <button
          onClick={() => setActiveSubTab('moderation')}
          className={activeSubTab === 'moderation' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '50px', fontSize: '0.85rem' }}
        >
          <ShieldAlert size={16} />
          Flagged Content ({flaggedComments.length + flaggedReviews.length})
        </button>
        <button
          onClick={() => setActiveSubTab('podcasts')}
          className={activeSubTab === 'podcasts' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '50px', fontSize: '0.85rem' }}
        >
          <Radio size={16} />
          Podcasts CRUD
        </button>
        <button
          onClick={() => setActiveSubTab('episodes')}
          className={activeSubTab === 'episodes' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '50px', fontSize: '0.85rem' }}
        >
          <Music size={16} />
          Episodes CRUD
        </button>
        <button
          onClick={() => setActiveSubTab('comments')}
          className={activeSubTab === 'comments' ? 'btn-primary' : 'btn-secondary'}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '50px', fontSize: '0.85rem' }}
        >
          <MessageSquare size={16} />
          Comments CRUD
        </button>
      </div>

      {/* TAB 1: METRICS OVERVIEW */}
      {activeSubTab === 'stats' && (
        <div>
          {loadingStats ? (
            <div className="skeleton-card glass-panel" style={{ height: '300px', borderRadius: '16px' }}></div>
          ) : stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
                <Users size={24} style={{ color: 'var(--color-primary-hover)', marginBottom: '12px' }} />
                <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Users</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)' }}>{stats.users.total}</p>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  <span>{stats.users.listeners} Listeners</span> • <span>{stats.users.creators} Creators</span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
                <Radio size={24} style={{ color: '#06b6d4', marginBottom: '12px' }} />
                <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Shows</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)' }}>{stats.podcasts}</p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {stats.episodes} total published episodes
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
                <Eye size={24} style={{ color: '#10b981', marginBottom: '12px' }} />
                <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Platform Plays</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)' }}>{stats.plays}</p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Sum of all episode playCounts
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: stats.flagged.total > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--border-color)' }}>
                <ShieldAlert size={24} style={{ color: '#ef4444', marginBottom: '12px' }} />
                <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Flagged Items</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '2rem', fontWeight: '700', color: stats.flagged.total > 0 ? '#ef4444' : 'var(--text-primary)' }}>{stats.flagged.total}</p>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  <span>{stats.flagged.comments} Comments</span> • <span>{stats.flagged.reviews} Reviews</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER ACCOUNTS */}
      {activeSubTab === 'users' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px' }}>
          {/* Filters Row            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search users by name, username or email..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                style={{ paddingLeft: '36px', height: '40px', width: '100%', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>
            <select
              value={userRoleFilter}
              onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }}
              style={{ 
                height: '40px', 
                padding: '0 12px', 
                borderRadius: '8px', 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>All Roles</option>
              <option value="listener" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Listener</option>
              <option value="creator" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Creator</option>
              <option value="admin" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Admin</option>
            </select>
            <select
              value={userStatusFilter}
              onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1); }}
              style={{ 
                height: '40px', 
                padding: '0 12px', 
                borderRadius: '8px', 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>All Statuses</option>
              <option value="active" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Active</option>
              <option value="suspended" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Suspended</option>
            </select>
            <button onClick={fetchUsers} className="btn-primary" style={{ height: '40px', borderRadius: '8px' }}>Search</button>
          </div>

          {/* Users Table */}
          {loadingUsers ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading accounts...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px 8px' }}>User</th>
                    <th style={{ padding: '12px 8px' }}>Role</th>
                    <th style={{ padding: '12px 8px' }}>Status</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((usr) => (
                    <tr key={usr._id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      <td 
                        onClick={() => fetchUserDetails(usr._id)}
                        style={{ padding: '16px 8px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                        title="Click to view full user profile metrics"
                      >
                        {usr.avatar ? (
                          <img src={window.getMediaUrl(usr.avatar)} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--grad-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {usr.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p style={{ fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>{usr.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>@{usr.username} • {usr.email}</p>
                        </div>
                      </td>
                      <td style={{ padding: '16px 8px' }}>
                        <select
                          value={usr.role}
                          onChange={(e) => handleChangeUserRole(usr._id, e.target.value)}
                          disabled={usr._id === user?._id}
                          style={{ 
                            padding: '6px 12px', 
                            borderRadius: '6px', 
                            background: 'var(--bg-card)', 
                            border: '1px solid var(--border-color)', 
                            color: 'var(--text-primary)', 
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          <option value="listener" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Listener</option>
                          <option value="creator" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Creator</option>
                          <option value="admin" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Admin</option>
                        </select>
                      </td>
                      <td style={{ padding: '16px 8px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: usr.accountStatus === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: usr.accountStatus === 'active' ? '#34d399' : '#f87171',
                        }}>
                          {usr.accountStatus}
                        </span>
                      </td>
                      <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleToggleUserStatus(usr._id)}
                          disabled={usr._id === user?._id}
                          className="btn-secondary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            borderColor: usr.accountStatus === 'active' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: usr.accountStatus === 'active' ? '#f87171' : '#34d399',
                            cursor: 'pointer'
                          }}
                        >
                          {usr.accountStatus === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(usr._id)}
                          disabled={usr._id === user?._id}
                          className="btn-secondary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            borderColor: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            marginLeft: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {userTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
              <button disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Prev</button>
              <span style={{ alignSelf: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Page {userPage} of {userTotalPages}</span>
              <button disabled={userPage === userTotalPages} onClick={() => setUserPage(p => p + 1)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Next</button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONTENT MODERATION */}
      {activeSubTab === 'moderation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', flexWrap: 'wrap' }}>
          {/* Flagged Comments Column */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <MessageSquare size={18} style={{ color: '#a855f7' }} />
              <h3 style={{ margin: 0 }}>Flagged Comments ({flaggedComments.length})</h3>
            </div>

            {loadingFlagged ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</p>
            ) : flaggedComments.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No flagged comments pending review.</p>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {flaggedComments.map(c => (
                  <div key={c._id} className="glass-panel" style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.85rem' }}>{c.userId?.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>@{c.userId?.username}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>On Episode: {c.episodeId?.title}</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0', background: 'var(--bg-main)', padding: '10px', borderRadius: '6px' }}>
                      "{c.content}"
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <button onClick={() => handleDismissComment(c._id)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Dismiss</button>
                      <button onClick={() => handleDeleteComment(c._id)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}><Trash2 size={12} style={{ marginRight: '4px' }} /> Delete</button>
                      <button onClick={() => handleToggleUserStatus(c.userId?._id)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}>Suspend Author</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Flagged Reviews Column */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Star size={18} style={{ color: '#fbbf24' }} />
              <h3 style={{ margin: 0 }}>Flagged Reviews ({flaggedReviews.length})</h3>
            </div>

            {loadingFlagged ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</p>
            ) : flaggedReviews.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No flagged reviews pending review.</p>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {flaggedReviews.map(r => (
                  <div key={r._id} className="glass-panel" style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.85rem' }}>{r.userId?.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>@{r.userId?.username}</span>
                      </div>
                      <div className="stars-row">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={10} fill={s <= r.rating ? '#fbbf24' : 'none'} color={s <= r.rating ? '#fbbf24' : 'var(--text-muted)'} />
                        ))}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>On Show: {r.podcastId?.title}</span>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0', background: 'var(--bg-main)', padding: '10px', borderRadius: '6px' }}>
                      "{r.comment || 'No comment text'}"
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <button onClick={() => handleDismissReview(r._id)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Dismiss</button>
                      <button onClick={() => handleDeleteReview(r._id)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}><Trash2 size={12} style={{ marginRight: '4px' }} /> Delete</button>
                      <button onClick={() => handleToggleUserStatus(r.userId?._id)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}>Suspend Author</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PODCASTS CRUD */}
      {activeSubTab === 'podcasts' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px' }}>
          <h3 style={{ marginBottom: '20px' }}>Global Podcasts Management</h3>
          {loadingPodcasts ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading podcasts...</div>
          ) : podcastsList.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No podcasts on the platform.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px 8px' }}>Podcast Details</th>
                    <th style={{ padding: '12px 8px' }}>Creator</th>
                    <th style={{ padding: '12px 8px' }}>Category</th>
                    <th style={{ padding: '12px 8px' }}>Stats</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {podcastsList.map((p) => (
                    <tr key={p._id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '16px 8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={window.getMediaUrl(p.coverImage)} alt="Cover" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                        <div>
                          <p style={{ fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>{p.title}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{p.status}</p>
                        </div>
                      </td>
                      <td style={{ padding: '16px 8px' }}>
                        <p style={{ margin: 0, color: 'var(--text-primary)' }}>{p.creatorId?.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>@{p.creatorId?.username}</p>
                      </td>
                      <td style={{ padding: '16px 8px' }}>{p.category}</td>
                      <td style={{ padding: '16px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {p.episodeCount} eps • {p.followersCount} followers
                      </td>
                      <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeletePodcast(p._id)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        >
                          Delete Show
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: EPISODES CRUD */}
      {activeSubTab === 'episodes' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px' }}>
          <h3 style={{ marginBottom: '20px' }}>Global Episodes Management</h3>
          {loadingEpisodes ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading episodes...</div>
          ) : episodesList.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No episodes on the platform.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px 8px' }}>Episode Title</th>
                    <th style={{ padding: '12px 8px' }}>Podcast Show</th>
                    <th style={{ padding: '12px 8px' }}>Play Count</th>
                    <th style={{ padding: '12px 8px' }}>AI Features</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {episodesList.map((e) => (
                    <tr key={e._id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '16px 8px', fontWeight: '600', color: 'var(--text-primary)' }}>{e.title}</td>
                      <td style={{ padding: '16px 8px' }}>{e.podcastId?.title || 'Unknown Podcast'}</td>
                      <td style={{ padding: '16px 8px' }}>{e.playCount} plays</td>
                      <td style={{ padding: '16px 8px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: e.aiSummary ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.05)',
                          color: e.aiSummary ? '#22d3ee' : 'var(--text-muted)'
                        }}>
                          {e.aiSummary ? 'Generated' : 'None'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteEpisode(e._id)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        >
                          Delete Episode
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: COMMENTS CRUD */}
      {activeSubTab === 'comments' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>Global Comments Management</h3>
            <div style={{ display: 'flex', gap: '8px', width: '300px' }}>
              <input
                type="text"
                placeholder="Search comments..."
                value={commentsSearch}
                onChange={(e) => setCommentsSearch(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  flexGrow: 1,
                  fontSize: '0.85rem'
                }}
              />
              <button 
                onClick={() => fetchComments(commentsSearch)} 
                className="btn-primary" 
                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              >
                Search
              </button>
            </div>
          </div>

          {loadingComments ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading comments...</div>
          ) : commentsList.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No comments found matching your query.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px 8px' }}>Comment Text</th>
                    <th style={{ padding: '12px 8px' }}>Author</th>
                    <th style={{ padding: '12px 8px' }}>Episode & Show</th>
                    <th style={{ padding: '12px 8px' }}>Date</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commentsList.map((c) => (
                    <tr key={c._id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '16px 8px', maxWidth: '300px', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                        {c.content}
                      </td>
                      <td style={{ padding: '16px 8px' }}>
                        <p style={{ margin: 0, color: 'var(--text-primary)' }}>{c.userId?.name || 'Deleted User'}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>@{c.userId?.username}</p>
                      </td>
                      <td style={{ padding: '16px 8px' }}>
                        <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-primary)' }}>{c.episodeId?.title || 'Deleted Episode'}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{c.episodeId?.podcastId?.title}</p>
                      </td>
                      <td style={{ padding: '16px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteCommentGlobal(c._id)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        >
                          Delete Comment
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* User Details Modal */}
      {selectedUserDetail && (
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
          <div className="glass-panel animate-scale-in" style={{
            padding: '32px',
            borderRadius: '20px',
            maxWidth: '650px',
            width: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setSelectedUserDetail(null)}
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

            {/* Header Profile Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
              {selectedUserDetail.user.avatar ? (
                <img 
                  src={window.getMediaUrl(selectedUserDetail.user.avatar)} 
                  alt="Avatar" 
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }} 
                />
              ) : (
                <div style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '50%', 
                  background: 'var(--grad-accent)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  color: '#fff' 
                }}>
                  {selectedUserDetail.user.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary)' }}>{selectedUserDetail.user.name}</h3>
                <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  @{selectedUserDetail.user.username} • {selectedUserDetail.user.email}
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: selectedUserDetail.user.role === 'admin' ? 'rgba(168, 85, 247, 0.15)' : (selectedUserDetail.user.role === 'creator' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.05)'),
                    color: selectedUserDetail.user.role === 'admin' ? '#c084fc' : (selectedUserDetail.user.role === 'creator' ? '#22d3ee' : 'var(--text-secondary)')
                  }}>
                    {selectedUserDetail.user.role}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: selectedUserDetail.user.accountStatus === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: selectedUserDetail.user.accountStatus === 'active' ? '#34d399' : '#f87171'
                  }}>
                    {selectedUserDetail.user.accountStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* General Meta Information */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Member Since</p>
                <p style={{ margin: '4px 0 0 0', fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {new Date(selectedUserDetail.user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Created Playlists</p>
                <p style={{ margin: '4px 0 0 0', fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {selectedUserDetail.details.playlistsCount} playlists
                </p>
              </div>
            </div>

            {/* Role specific info: Creator Podcasts */}
            {(selectedUserDetail.user.role === 'creator' || selectedUserDetail.user.role === 'admin') && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '12px', fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Owned Podcasts ({selectedUserDetail.details.podcasts.length})
                </h4>
                {selectedUserDetail.details.podcasts.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>No podcast shows created yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedUserDetail.details.podcasts.map((p) => (
                      <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.01)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <img src={window.getMediaUrl(p.coverImage)} alt="Show cover" style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }} />
                        <div style={{ flexGrow: 1 }}>
                          <p style={{ margin: 0, fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.title}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.category} • {p.status}</p>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.episodeCount} eps</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Listener specific info: Comments */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '12px', fontSize: '1rem', color: 'var(--text-primary)' }}>
                Recent Comments ({selectedUserDetail.details.comments.length})
              </h4>
              {selectedUserDetail.details.comments.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>No comments posted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedUserDetail.details.comments.map((c) => (
                    <div key={c._id} style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>"{c.content}"</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        On: <span style={{ fontWeight: '600' }}>{c.episodeId?.title || 'Unknown Episode'}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews */}
            <div>
              <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '12px', fontSize: '1rem', color: 'var(--text-primary)' }}>
                Recent Reviews ({selectedUserDetail.details.reviews.length})
              </h4>
              {selectedUserDetail.details.reviews.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>No reviews written yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedUserDetail.details.reviews.map((r) => (
                    <div key={r._id} style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Star size={12} fill="currentColor" /> {r.rating}/5
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-primary)' }}>"{r.content}"</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Show: <span style={{ fontWeight: '600' }}>{r.podcastId?.title || 'Unknown Show'}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Loading User Details Spinner Overlay */}
      {loadingUserDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999
        }}>
          <div className="glass-panel" style={{ padding: '20px 30px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="animate-spin" style={{ width: '20px', height: '20px', border: '2px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
            <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '500' }}>Fetching profile metrics...</span>
          </div>
        </div>
      )}

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
                style={{ padding: '8px 20px', borderRadius: '50px', background: '#ef4444', borderColor: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
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
