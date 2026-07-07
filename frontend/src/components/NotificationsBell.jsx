import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Bell, CheckSquare, MessageSquare, Radio } from 'lucide-react';
import './NotificationsBell.css';

export default function NotificationsBell() {
  const { token, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchNotifications();
      // Poll notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleMarkRead = async (id, podcastId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, read: true } : n))
        );
        setShowDropdown(false);
        if (podcastId) {
          navigate(`/podcast/${podcastId}`);
        }
      }
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="notifications-bell-container">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        className={`bell-icon-btn ${unreadCount > 0 ? 'pulse' : ''}`}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
      </button>

      {showDropdown && (
        <div className="notifications-dropdown glass-panel">
          <div className="notifications-dropdown-header">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="mark-all-btn">
                <CheckSquare size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>
          
          <hr className="dropdown-divider" style={{ margin: '8px 0' }} />

          <div className="notifications-dropdown-list">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleMarkRead(notif._id, notif.podcastId)}
                  className={`notification-dropdown-item ${!notif.read ? 'unread' : ''}`}
                >
                  <div className="notif-icon-wrapper">
                    <Radio size={16} />
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <p className="notif-dropdown-title">{notif.title}</p>
                    <p className="notif-dropdown-content">{notif.content}</p>
                    <span className="notif-dropdown-time">
                      {new Date(notif.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {!notif.read && <div className="unread-dot"></div>}
                </div>
              ))
            ) : (
              <div className="empty-notifications">No notifications yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
