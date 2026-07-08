import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Music, Search, User, LogOut, Radio, LayoutDashboard, Compass, ListMusic, Download, Sliders, Clock, ShieldAlert, Bot, Sun, Moon } from 'lucide-react';
import NotificationsBell from './NotificationsBell';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    document.body.classList.toggle('dark-theme', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

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

          <button 
            onClick={() => setIsDark(!isDark)} 
            className="theme-toggle-btn"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              padding: '8px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-default)',
              transition: 'var(--transition-fast)'
            }}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user && <NotificationsBell />}

          {user ? (
            <div className="navbar-user">
              <button 
                className="user-profile-btn" 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                style={{
                  borderColor: user.role === 'creator' ? 'rgba(249, 115, 22, 0.4)' : user.role === 'admin' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(16, 185, 129, 0.4)'
                }}
              >
                {user.avatar ? (
                  <div style={{ position: 'relative', display: 'flex' }}>
                    <img 
                      src={`window.BACKEND_URL${user.avatar}`} 
                      alt="Avatar" 
                      className="user-avatar" 
                      style={{ 
                        border: `2px solid ${user.role === 'creator' ? '#f97316' : user.role === 'admin' ? '#a855f7' : '#10b981'}`,
                        boxShadow: `0 0 8px ${user.role === 'creator' ? 'rgba(249, 115, 22, 0.4)' : user.role === 'admin' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
                      }} 
                    />
                    {user.role === 'admin' && (
                      <div style={{
                        position: 'absolute',
                        bottom: '-4px',
                        right: '-4px',
                        background: '#a855f7',
                        borderRadius: '50%',
                        padding: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #1a1a1a',
                        boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                      }} title="System Admin">
                        <Bot size={10} style={{ color: '#fff' }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ position: 'relative', display: 'flex' }}>
                    <div 
                      className="avatar-placeholder" 
                      style={{ 
                        background: user.role === 'creator' ? '#f97316' : user.role === 'admin' ? '#a855f7' : '#10b981',
                        boxShadow: `0 0 8px ${user.role === 'creator' ? 'rgba(249, 115, 22, 0.4)' : user.role === 'admin' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
                      }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    {user.role === 'admin' && (
                      <div style={{
                        position: 'absolute',
                        bottom: '-4px',
                        right: '-4px',
                        background: '#a855f7',
                        borderRadius: '50%',
                        padding: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #1a1a1a',
                        boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                      }} title="System Admin">
                        <Bot size={10} style={{ color: '#fff' }} />
                      </div>
                    )}
                  </div>
                )}
                <span className="user-name-text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {user.name}
                  {user.role === 'admin' && <Bot size={14} style={{ color: '#a855f7' }} />}
                </span>
              </button>

              {dropdownOpen && (
                <div className="user-dropdown glass-panel" style={{ zIndex: 110 }}>
                  <div className="dropdown-info">
                    <p className="info-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {user.name}
                      {user.role === 'admin' && <Bot size={16} style={{ color: '#a855f7' }} />}
                    </p>
                    <p className="info-role" style={{ color: 'var(--text-secondary)' }}>
                      @{user.username} • <span style={{ 
                        color: user.role === 'creator' ? '#f97316' : user.role === 'admin' ? '#a855f7' : '#10b981',
                        fontWeight: '600'
                      }}>{user.role}</span>
                    </p>
                  </div>
                  <Link to="/settings" className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', color: '#ffffff', transition: 'background 0.2s', width: '100%', textAlign: 'left' }}>
                    <Sliders size={16} />
                    <span>Preferences</span>
                  </Link>
                  <Link to="/explore" className="dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', color: '#ffffff', transition: 'background 0.2s', width: '100%', textAlign: 'left' }}>
                    <Compass size={16} />
                    <span>Discover Podcasts</span>
                  </Link>
                  <hr className="dropdown-divider" style={{ margin: '8px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />
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
