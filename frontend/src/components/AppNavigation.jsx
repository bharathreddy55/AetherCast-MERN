import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AudioLines, Home, Search, Library, Upload, Settings, Radio, Sun, Moon, LogOut, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './AppNavigation.css';

export default function AppNavigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('theme') !== 'light'; } catch { return true; } });
  useEffect(() => {
    document.body.classList.toggle('dark-theme', dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* Appearance is optional. */ }
  }, [dark]);
  useEffect(() => { if (location.pathname === '/music/search') setQuery(new URLSearchParams(location.search).get('q') || ''); }, [location.pathname, location.search]);
  const search = event => { event.preventDefault(); navigate(`/music/search?q=${encodeURIComponent(query.trim())}`); };
  const brand = <Link to="/music" className="aether-brand"><span><AudioLines size={24} /></span>AetherCast</Link>;
  const theme = <button className="aether-icon" onClick={() => setDark(value => !value)} aria-label={dark ? 'Use light theme' : 'Use dark theme'}>{dark ? <Sun size={20} /> : <Moon size={20} />}</button>;
  return <>
    <a className="aether-skip" href="#main-content">Skip to content</a>
    {user && <aside className="aether-sidebar" aria-label="Main navigation">
      {brand}<p className="aether-nav-caption">YOUR SPACE</p>
      <nav><NavLink to="/music" end><Home size={20} />Listen</NavLink>
        <NavLink to="/music/search"><Search size={20} />Search</NavLink><NavLink to="/library"><Library size={20} />Your library</NavLink>
        <NavLink to="/music/import"><Upload size={20} />Import music</NavLink></nav>
      <div className="aether-library-shortcuts"><Link to="/music?view=albums">Albums <ArrowUpRight size={15} /></Link><Link to="/music?view=artists">Artists <ArrowUpRight size={15} /></Link><Link to="/music/collections?view=likes">Liked songs</Link><Link to="/music/collections?view=playlists">Music playlists</Link><Link to="/music/collections?view=history">Recently played</Link></div>
      <details className="aether-extra-nav"><summary>Podcasts & tools</summary><nav><Link to="/explore"><Radio size={18} />Browse podcasts</Link><Link to="/podcasts">Podcast home</Link><Link to="/playlists">Episode playlists</Link><Link to="/downloads">Episode downloads</Link><Link to="/history">Podcast history</Link>
        {['creator', 'admin'].includes(user.role) && <Link to="/creator">Creator tools</Link>}{user.role === 'admin' && <Link to="/admin">Admin tools</Link>}</nav></details>
      <div className="aether-sidebar-bottom"><NavLink to="/settings"><Settings size={19} />Settings</NavLink><p>Your library. Your rhythm.</p></div>
    </aside>}
    <header className={`aether-topbar ${user ? 'private' : ''}`}>
      <div className="aether-mobile-brand">{brand}</div>
      {user ? <form onSubmit={search} className="aether-global-search"><Search size={18} aria-hidden="true" /><input aria-label="Search your music library" placeholder="Find something to play" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} /></form> : <span className="aether-public-note">A private place for your music</span>}
      <div className="aether-topbar-actions">{user && <Link className="aether-icon aether-podcast-link" to="/explore" aria-label="Optional podcasts"><Radio size={20} /></Link>}{theme}
        {user ? <><Link to="/settings" className="aether-account" aria-label="Owner settings">{(user.name || 'You').slice(0, 1).toUpperCase()}</Link><button className="aether-icon" onClick={logout} aria-label="Sign out"><LogOut size={19} /></button></> : <Link className="aether-login-link" to="/login">Sign in</Link>}
      </div>
    </header>
    {user && <nav className="aether-mobile-nav" aria-label="Mobile navigation"><Link to="/music" aria-current={location.pathname === '/music' ? 'page' : undefined}><Home size={20} />Listen</Link><Link to="/music/search" aria-current={location.pathname === '/music/search' ? 'page' : undefined}><Search size={20} />Search</Link><NavLink to="/library"><Library size={20} />Library</NavLink><NavLink to="/music/import"><Upload size={20} />Import</NavLink></nav>}
  </>;
}
