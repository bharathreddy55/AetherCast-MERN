import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Music, Search, User, LogOut, Radio, LayoutDashboard, Compass, ListMusic, Download, Sliders, Clock, ShieldAlert } from 'lucide-react';
import NotificationsBell from './NotificationsBell';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar glass-panel">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <Radio className="logo-icon" />
          <span className="logo-text gradient-text">AetherCast</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
            <Compass size={18} />
            <span>Explore</span>
          </Link>
          {user && (
            <>
              <Link to="/home" className={`nav-link ${isActive('/home') ? 'active' : ''}`}>
                <Music size={18} />
                <span>Home</span>
              </Link>
              <Link to="/playlists" className={`nav-link ${isActive('/playlists') ? 'active' : ''}`}>
                <ListMusic size={18} />
                <span>Playlists</span>
              </Link>
              <Link to="/downloads" className={`nav-link ${isActive('/downloads') ? 'active' : ''}`}>
                <Download size={18} />
                <span>Downloads</span>
              </Link>
              <Link to="/library" className={`nav-link ${isActive('/library') ? 'active' : ''}`}>
                <Clock size={18} />
                <span>Library</span>
              </Link>
              {user.role === 'creator' && (
                <Link to="/creator" className={`nav-link ${isActive('/creator') ? 'active' : ''}`}>
                  <LayoutDashboard size={18} />
                  <span>Dashboard</span>
                </Link>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>
                  <ShieldAlert size={18} />
                  <span>Admin Panel</span>
                </Link>
              )}
            </>
          )}
        </div>

        <div className="navbar-actions">
          <Link to="/explore" className="navbar-search-btn btn-secondary">
            <Search size={16} />
            <span className="search-text">Search...</span>
          </Link>

          {user && <NotificationsBell />}

          {user ? (
            <div className="navbar-user">
              <button 
                className="user-profile-btn" 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
              >
                {user.avatar ? (
                  <img src={`http://localhost:5000${user.avatar}`} alt="Avatar" className="user-avatar" />
                ) : (
                  <div className="avatar-placeholder">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="user-name-text">{user.name}</span>
              </button>

              {dropdownOpen && (
                <div className="user-dropdown glass-panel">
                  <div className="dropdown-info">
                    <p className="info-name">{user.name}</p>
                    <p className="info-role">@{user.username} • {user.role}</p>
                  </div>
                  <Link to="/settings" className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', color: '#ffffff', transition: 'background 0.2s', width: '100%', textAlign: 'left' }}>
                    <Sliders size={16} />
                    <span>Preferences</span>
                  </Link>
                  <hr className="dropdown-divider" />
                  <button onClick={logout} className="dropdown-item logout-btn">
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="navbar-auth-buttons">
              <Link to="/login" className="btn-secondary">Log In</Link>
              <Link to="/register" className="btn-primary">Sign Up</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
