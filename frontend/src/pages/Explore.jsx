import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Search, SlidersHorizontal } from 'lucide-react';
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
      <header style={{ marginBottom: '32px' }}>
        <h2>Discover Podcasts</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Explore shows across different categories, search by keywords, and find your next favorite creator.
        </p>
      </header>

      {/* Search Input */}
      <div className="explore-search-wrap">
        <div className="explore-search-bar">
          <Search size={20} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Search by title, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-bar-input"
          />
        </div>
      </div>

      {/* Category Selection Carousel */}
      <div className="categories-scroll">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="loading-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="skeleton-card glass-panel" style={{ borderRadius: '16px' }}></div>
          ))}
        </div>
      ) : podcasts.length > 0 ? (
        <div className="podcast-grid">
          {podcasts.map((podcast) => (
            <PodcastCard key={podcast._id} podcast={podcast} />
          ))}
        </div>
      ) : (
        <div className="empty-state glass-panel">
          <h3>No podcasts match your search</h3>
          <p>Try searching for different keywords or category filters.</p>
        </div>
      )}

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
              background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.2rem',
              boxShadow: '0 4px 20px rgba(168, 85, 247, 0.3)'
            }}>
              👋
            </div>
            <h3 style={{ fontSize: '1.6rem', fontWeight: '700', margin: '8px 0 0 0', color: '#fff' }}>
              Hello, {user?.name || 'User'}!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
              Welcome back to AetherCast! Ready to dive back into your favorite podcasts?
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
                boxShadow: '0 4px 15px rgba(6, 182, 212, 0.3)'
              }}
            >
              Let's Listen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
