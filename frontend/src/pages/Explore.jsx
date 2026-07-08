import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Search, SlidersHorizontal, TrendingUp } from 'lucide-react';
import PodcastCard from '../components/PodcastCard';
import './Pages.css';

const CATEGORIES = [
  'All',
  'Technology',
  'Business',
  'Comedy',
  'Society',
  'Music',
  'Education',
  'News',
  'Science'
];

export default function Explore() {
  const [podcasts, setPodcasts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.showWelcome) {
      setShowWelcomePopup(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Debounced search
  useEffect(() => {
    const fetchFiltered = async () => {
      setLoading(true);
      try {
        let url = `${API_BASE_URL}/podcasts?`;
        
        if (selectedCategory && selectedCategory !== 'All') {
          url += `category=${encodeURIComponent(selectedCategory)}&`;
        }
        if (search) {
          url += `search=${encodeURIComponent(search)}&`;
        }

        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setPodcasts(data.podcasts);
        }
      } catch (err) {
        console.error('Failed to search podcasts', err);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      fetchFiltered();
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounce);
  }, [search, selectedCategory]);

  return (
    <div className="explore-page animate-fade-in">
      {/* Header Section */}
      <header style={{
        marginBottom: '0',
        paddingBottom: '32px',
        borderBottom: '1px solid var(--border-color)',
        textAlign: 'center'
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--color-primary)',
          letterSpacing: '0.2em',
          display: 'block',
          marginBottom: '12px'
        }}>[ EXPLORE CATALOG ]</span>
        <h2 style={{
          fontFamily: 'var(--font-serif)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          margin: '0 0 12px 0'
        }}>DISCOVER PODCASTS</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
          Explore shows across different categories, search by keywords, and find your next favorite creator.
        </p>
      </header>

      {/* Search Input */}
      <div className="explore-search-wrap" style={{
        paddingTop: '28px',
        paddingBottom: '28px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div className="explore-search-bar" style={{ background: 'var(--bg-card)' }}>
          <Search size={20} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Search by title, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-bar-input"
            style={{ background: 'transparent' }}
          />
        </div>
      </div>

      {/* Category Selection Carousel */}
      <div style={{
        paddingTop: '28px',
        paddingBottom: '28px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--color-primary)',
          letterSpacing: '0.2em',
          display: 'block',
          marginBottom: '16px'
        }}>[ FILTER BY CHANNEL ]</span>
        <div className="categories-scroll">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
              style={selectedCategory === cat ? {
                background: 'var(--color-primary)',
                color: '#000000',
                boxShadow: '0 4px 10px rgba(255, 122, 0, 0.2)'
              } : {}}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Trending Stacked Cards + Results Grid */}
      <div style={{ paddingTop: '28px' }}>
        {loading ? (
          <div className="loading-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton-card glass-panel" style={{ borderRadius: 'var(--radius-lg)' }}></div>
            ))}
          </div>
        ) : podcasts.length > 0 ? (
          <>
            {/* Stacked Trending Preview */}
            {podcasts.length >= 4 && (
              <div style={{ marginBottom: '60px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
                    <h3 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>Trending Broadcasts</h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>[ TOP 4 ]</span>
                </div>

                <div className="trending-stack">
                  {podcasts.slice(0, 4).map((podcast, idx) => (
                    <Link
                      key={podcast._id}
                      to={`/podcast/${podcast._id}`}
                      className="trending-stack-item"
                      style={{ transitionDelay: `${(idx + 1) * 50}ms`, '--i': idx + 1 }}
                    >
                      <span className="ts-idx">{String(idx + 1).padStart(2, '0')}</span>
                      {podcast.coverImage ? (
                        <img src={window.getMediaUrl(podcast.coverImage)} alt={podcast.title} />
                      ) : (
                        <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-default)', background: 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>🎙️</div>
                      )}
                      <div className="ts-content">
                        <h4>{podcast.title}</h4>
                        <p>by {podcast.creatorId?.name || 'Unknown'} · {podcast.episodeCount} episodes</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* All Results Grid */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderTop: '1px solid var(--border-color)', paddingTop: '28px' }}>
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>All Shows</h3>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>[ {podcasts.length} RESULTS ]</span>
            </div>
            <div className="podcast-grid">
              {podcasts.map((podcast) => (
                <PodcastCard key={podcast._id} podcast={podcast} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state glass-panel">
            <h3>No podcasts match your search</h3>
            <p>Try searching for different keywords or category filters.</p>
          </div>
        )}
      </div>

      {/* Welcome Popup */}
      {showWelcomePopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleIn {
              from { transform: scale(0.92); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>
          <div className="glass-panel" style={{
            padding: '40px',
            borderRadius: '24px',
            textAlign: 'center',
            maxWidth: '420px',
            width: '90%',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'var(--grad-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.2rem',
              boxShadow: '0 4px 20px rgba(255, 122, 0, 0.3)'
            }}>
              👋
            </div>
            <h3 style={{
              fontSize: '1.6rem',
              fontWeight: '700',
              margin: '8px 0 0 0',
              color: '#fff',
              fontFamily: 'var(--font-serif)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Hello, {user?.name || 'User'}!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
              Welcome back to VOX! Ready to dive back into your favorite podcasts?
            </p>
            <button
              onClick={() => {
                setShowWelcomePopup(false);
                navigate('/explore');
              }}
              className="btn-primary"
              style={{
                marginTop: '16px',
                padding: '12px 28px',
                borderRadius: '50px',
                fontSize: '0.9rem',
                fontWeight: '600',
                width: '100%',
                cursor: 'pointer',
                border: 0,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                boxShadow: '0 4px 15px rgba(255, 122, 0, 0.3)'
              }}
            >
              LET'S LISTEN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
