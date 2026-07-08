import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Music, Search, User, LogOut, Radio, LayoutDashboard, Compass, ListMusic, Download, Sliders, Clock, ShieldAlert, Bot, Sun, Moon, Menu, X } from 'lucide-react';
import NotificationsBell from './NotificationsBell';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved !== 'light';
  });
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('dark-theme', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Scroll active / stationary morph detection
  useEffect(() => {
    const onScroll = () => {
      setIsScrolling(true);
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 300); // 300ms delay to return back gently
    };
    
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => { setMobileMenuOpen(false); }, [location]);

  // Magnetic button effect
  const handleMagnet = useCallback((e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    btn.style.transform = `translate(${dx * 0.28}px, ${dy * 0.28}px)`;
  }, []);
  const handleMagnetLeave = useCallback((e) => {
    e.currentTarget.style.transform = '';
  }, []);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`navbar ${isScrolling ? 'navbar-scrolling' : ''}`}>
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <Radio className="logo-icon" />
          <span className="logo-text gradient-text">VOX</span>
        </Link>

        <div className="navbar-links">
          {[
            { to: '/', label: 'Explore', icon: <Compass size={16} /> },
            ...(user ? [
              { to: '/home', label: 'Home', icon: <Music size={16} /> },
              { to: '/playlists', label: 'Playlists', icon: <ListMusic size={16} /> },
              { to: '/downloads', label: 'Downloads', icon: <Download size={16} /> },
              { to: '/library', label: 'Library', icon: <Clock size={16} /> },
              ...(user.role === 'creator' ? [{ to: '/creator', label: 'Dashboard', icon: <LayoutDashboard size={16} /> }] : []),
              ...(user.role === 'admin' ? [{ to: '/admin', label: 'Admin Panel', icon: <ShieldAlert size={16} /> }] : []),
            ] : []),
          ].map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link ${isActive(to) ? 'active' : ''}`}
              onMouseMove={handleMagnet}
              onMouseLeave={handleMagnetLeave}
            >
              {icon}
              <span className="nav-link-label">
                {label}
                {/* Active indicator dot */}
                {isActive(to) && <span className="nav-active-dot" />}
              </span>
              {/* Liquid underline */}
              <span className={`nav-underline ${isActive(to) ? 'nav-underline-active' : ''}`} />
            </Link>
          ))}
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

          <button 
            className="mobile-menu-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            title="Toggle Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

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
                      src={window.getMediaUrl(user.avatar)} 
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
                  <Link to="/settings" className="dropdown-item">
                    <Sliders size={16} />
                    <span>Preferences</span>
                  </Link>
                  <Link to="/explore" className="dropdown-item">
                    <Compass size={16} />
                    <span>Discover Podcasts</span>
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

      {mobileMenuOpen && (
        <div className="navbar-mobile-menu animate-fade-in">
          {/* Mobile Search */}
          <Link to="/explore" className="mobile-search-bar">
            <Search size={16} />
            <span>Search Broadcasts...</span>
          </Link>

          {/* Navigation Links */}
          <div className="mobile-menu-links">
            <Link to="/" className={`mobile-nav-link ${isActive('/') ? 'active' : ''}`}>
              <Compass size={18} />
              <span>Explore</span>
            </Link>
            {user && (
              <>
                <Link to="/home" className={`mobile-nav-link ${isActive('/home') ? 'active' : ''}`}>
                  <Music size={18} />
                  <span>Home</span>
                </Link>
                <Link to="/playlists" className={`mobile-nav-link ${isActive('/playlists') ? 'active' : ''}`}>
                  <ListMusic size={18} />
                  <span>Playlists</span>
                </Link>
                <Link to="/downloads" className={`mobile-nav-link ${isActive('/downloads') ? 'active' : ''}`}>
                  <Download size={18} />
                  <span>Downloads</span>
                </Link>
                <Link to="/library" className={`mobile-nav-link ${isActive('/library') ? 'active' : ''}`}>
                  <Clock size={18} />
                  <span>Library</span>
                </Link>
                {user.role === 'creator' && (
                  <Link to="/creator" className={`mobile-nav-link ${isActive('/creator') ? 'active' : ''}`}>
                    <LayoutDashboard size={18} />
                    <span>Dashboard</span>
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link to="/admin" className={`mobile-nav-link ${isActive('/admin') ? 'active' : ''}`}>
                    <ShieldAlert size={18} />
                    <span>Admin Panel</span>
                  </Link>
                )}
              </>
            )}
          </div>

          <hr className="dropdown-divider" style={{ margin: '12px 0' }} />

          {/* Mobile Theme Toggle */}
          <button onClick={() => setIsDark(!isDark)} className="mobile-menu-action">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
          </button>

          {/* Mobile User & Auth Actions */}
          {user ? (
            <div className="mobile-user-section">
              <div className="mobile-user-info">
                {user.avatar ? (
                  <img src={window.getMediaUrl(user.avatar)} alt="Avatar" className="user-avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div className="avatar-fallback" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={18} /></div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="user-name" style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{user.name}</span>
                  <span className="user-role" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user.role}</span>
                </div>
              </div>
              <Link to="/settings" className="mobile-menu-action">
                <Sliders size={18} />
                <span>Preferences</span>
              </Link>
              <button onClick={logout} className="mobile-menu-action logout-btn" style={{ width: '100%', textAlign: 'left' }}>
                <LogOut size={18} />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <div className="mobile-auth-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <Link to="/login" className="btn-secondary" style={{ width: '100%', justifyContent: 'center', display: 'inline-flex' }}>Log In</Link>
              <Link to="/register" className="btn-primary" style={{ width: '100%', justifyContent: 'center', display: 'inline-flex' }}>Sign Up</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
