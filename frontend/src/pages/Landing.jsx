import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { ArrowRight, Star, TrendingUp, Play, Heart } from 'lucide-react';
import PodcastCard from '../components/PodcastCard';
import './Pages.css'; // Let's combine standard layout styles in Pages.css

export default function Landing() {
  const { user } = useAuth();
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/podcasts?limit=4`);
        const data = await res.json();
        if (data.success) {
          setPodcasts(data.podcasts);
        }
      } catch (err) {
        console.error('Failed to load featured podcasts', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  return (
    <div className="landing-page animate-fade-in">
      {/* Hero Section */}
      <header className="hero-section glass-panel">
        <div className="hero-content">
          <div className="hero-badge">
            <Star size={14} className="badge-icon" />
            <span>Introducing AetherCast v2.0</span>
          </div>
          <h1 className="hero-title">
            Immerse Yourself in <br />
            <span className="gradient-text font-heavy">Infinite Soundscapes</span>
          </h1>
          <p className="hero-subtitle">
            A premium podcast ecosystem for independent creators and passionate listeners. 
            Stream high-fidelity episodes, follow your favorites, and save your progress on the fly.
          </p>
          <div className="hero-cta-buttons">
            {user ? (
              <Link to="/home" className="btn-primary">
                <span>Go to dashboard</span>
                <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary">
                  <span>Start listening free</span>
                  <ArrowRight size={18} />
                </Link>
                <Link to="/explore" className="btn-secondary">
                  <span>Explore podcasts</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Decorative elements */}
        <div className="hero-visual">
          <div className="pulsing-glow"></div>
          <div className="circle-ring r1"></div>
          <div className="circle-ring r2"></div>
        </div>
      </header>

      {/* Featured Podcasts */}
      <section className="featured-section">
        <div className="section-header">
          <div className="section-title-wrap">
            <TrendingUp size={20} className="title-icon" />
            <h2>Trending on AetherCast</h2>
          </div>
          <Link to="/explore" className="view-all-link">
            <span>View All</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="loading-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton-card glass-panel"></div>
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
            <h3>No podcasts found</h3>
            <p>Become the first creator by registering and uploading your series!</p>
            <Link to="/register?role=creator" className="btn-primary" style={{ marginTop: '16px' }}>
              Create a Podcast
            </Link>
          </div>
        )}
      </section>

      {/* Why Choose Us */}
      <section className="features-grid-section">
        <div className="feature-card glass-panel">
          <div className="feature-icon-wrap">
            <Play size={20} />
          </div>
          <h3>Smart Playback</h3>
          <p>Pause on any device and resume from the exact microsecond. Our sync engine ensures you never lose your spot.</p>
        </div>

        <div className="feature-card glass-panel">
          <div className="feature-icon-wrap">
            <Heart size={20} />
          </div>
          <h3>Creator Friendly</h3>
          <p>Upload files seamlessly, manage draft episodes, check viewer counts, and view rich listening statistics.</p>
        </div>
      </section>
    </div>
  );
}
