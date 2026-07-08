import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { ArrowRight, Star, TrendingUp, Play, Heart } from 'lucide-react';
import PodcastCard from '../components/PodcastCard';
import './Pages.css'; // Let's combine standard layout styles in Pages.css

export default function Landing() {
  const { user } = useAuth();
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredRow, setHoveredRow] = useState(null);
  const dirRowRefs = useRef([]);

  // Scroll-in reveal for Info Directory rows
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateX(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    dirRowRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

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

  const getCoverImage = (podcast) => {
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
    <div className="landing-page animate-fade-in">
      
      {/* Centralized Console Header Stack */}
      <header className="hero-section">
        <span className="badge-mono">VOX HUB</span>
        <h1 className="hero-title">
          Immerse Yourself in <br />
          <span className="gradient-text">Infinite Soundscapes</span>
        </h1>
        <p className="hero-subtitle">
          A premium podcast ecosystem for independent creators and passionate listeners. 
          Stream high-fidelity episodes, follow your favorites, and save your progress on the fly.
        </p>
        <div className="hero-cta-buttons">
          {user ? (
            <Link to="/home" className="btn-primary">
              <span>GO TO DASHBOARD</span>
              <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary">
                <span>START LISTENING FREE</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/explore" className="btn-secondary">
                <span>EXPLORE CATALOG</span>
              </Link>
            </>
          )}
        </div>

        {/* Central Widescreen Banner Visual block */}
        <div className="banner-visual">
          <div className="banner-bg"></div>
          <div className="banner-overlay"></div>
        </div>
      </header>

      {/* Rhythmic Category Vertical List Overlay */}
      <section className="category-section">
        <span className="badge-mono">POPULAR CHANNELS</span>
        <div className="category-list">
          <span style={{ color: 'var(--color-primary)' }}>TECHNOLOGY</span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span>BUSINESS</span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--color-primary)' }}>COMEDY</span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span>SOCIETY</span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--color-primary)' }}>EDUCATION</span>
        </div>
      </section>

      {/* Featured Podcasts List Grid */}
      <section className="featured-section">
        <div className="section-header">
          <div className="section-title">
            <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className="brand-heading">Trending Broadcasts</h2>
          </div>
          <Link to="/explore" className="view-all-link">
            <span>VIEW ALL</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="loading-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton-card glass-panel"></div>
            ))}
          </div>
        ) : podcasts.length > 0 ? (
          <>
            <div className="trending-stack">
              {podcasts.slice(0, 4).map((podcast, idx) => (
                <Link
                  key={podcast._id}
                  to={`/podcast/${podcast._id}`}
                  className="trending-stack-item"
                  style={{ transitionDelay: `${(idx + 1) * 50}ms`, '--i': idx + 1 }}
                >
                  <span className="ts-idx">{String(idx + 1).padStart(2, '0')}</span>
                  <img src={getCoverImage(podcast)} alt={podcast.title} />
                  <div className="ts-content">
                    <h4>{podcast.title}</h4>
                    <p>by {podcast.creatorId?.name || 'Unknown'} · {podcast.episodeCount} episodes</p>
                  </div>
                </Link>
              ))}
            </div>

            {podcasts.length > 4 && (
              <div className="podcast-grid">
                {podcasts.slice(4).map((podcast) => (
                  <PodcastCard key={podcast._id} podcast={podcast} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state glass-panel">
            <h3>No podcasts found</h3>
            <p style={{ margin: '12px 0' }}>Become the first creator by registering and uploading your series!</p>
            <Link to="/register?role=creator" className="btn-primary">
              Create a Podcast
            </Link>
          </div>
        )}
      </section>

      {/* Tabular Console Row Directory (Why Choose Us) */}
      <section style={{ padding: '80px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', letterSpacing: '0.2em' }}>[ SYSTEM SPECIFICATIONS ]</span>
          <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Info Directory</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-color)' }}>
          {[
            { num: '01', title: 'Smart Playback Engine', desc: 'Pause on any device and resume from the exact microsecond. Our sync engine ensures you never lose your spot.' },
            { num: '02', title: 'Creator Workspaces', desc: 'Upload files seamlessly, manage draft episodes, check listener statistics, and publish to the global audio-verse.' },
            { num: '03', title: 'Interactive Transcripts', desc: 'Explore episodes with live, interactive speech transcripts that synchronize instantly during playback.' },
          ].map((item, i) => (
            <div
              key={item.num}
              ref={(el) => (dirRowRefs.current[i] = el)}
              onMouseEnter={() => setHoveredRow(i)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                display: 'flex',
                padding: '28px 16px',
                borderBottom: '1px solid var(--border-color)',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'default',
                /* Initial hidden state for scroll-in reveal */
                opacity: 0,
                transform: 'translateX(-40px)',
                transition: `opacity 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 0.15}s, transform 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 0.15}s`,
              }}
            >
              {/* Hover sweep background */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--grad-accent)',
                opacity: hoveredRow === i ? 0.06 : 0,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none',
              }} />
              {/* Left accent bar */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: hoveredRow === i ? '0%' : '100%',
                width: '3px',
                height: '100%',
                background: 'var(--color-primary)',
                transition: 'top 0.35s cubic-bezier(0.16,1,0.3,1)',
                borderRadius: '0 2px 2px 0',
              }} />
              <span style={{
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono)',
                color: hoveredRow === i ? 'var(--color-primary)' : 'var(--text-muted)',
                minWidth: '40px',
                transition: 'color 0.3s ease',
                fontWeight: hoveredRow === i ? '700' : '400',
              }}>{item.num}</span>
              <span style={{
                fontSize: '1.1rem',
                fontFamily: 'var(--font-serif)',
                textTransform: 'uppercase',
                fontWeight: '700',
                minWidth: '240px',
                color: hoveredRow === i ? 'var(--color-primary)' : 'var(--text-primary)',
                transition: 'color 0.3s ease',
              }}>{item.title}</span>
              <p style={{
                color: 'var(--text-secondary)',
                flexGrow: 1,
                fontSize: '0.95rem',
                margin: 0,
                lineHeight: '1.6',
              }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
