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
  const [spotPos, setSpotPos] = useState({ x: -999, y: -999 });
  const [spotActive, setSpotActive] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const dirSectionRef = useRef(null);
  const dirRowRefs = useRef([]);

  // Scroll-in reveal for Info Directory rows
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    dirRowRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const handleSpotMove = (e) => {
    const rect = dirSectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSpotPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

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
      <section
        ref={dirSectionRef}
        onMouseMove={handleSpotMove}
        onMouseEnter={() => setSpotActive(true)}
        onMouseLeave={() => setSpotActive(false)}
        style={{
          padding: '80px 0',
          position: 'relative',
          overflow: 'hidden',
          '--spot-x': `${spotPos.x}px`,
          '--spot-y': `${spotPos.y}px`,
        }}
      >
        {/* Spotlight radial glow that follows cursor */}
        <div
          className="dir-spotlight"
          aria-hidden="true"
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            inset: 0,
            zIndex: 0,
            opacity: spotActive ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', letterSpacing: '0.2em' }}>[ SYSTEM SPECIFICATIONS ]</span>
          <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Info Directory</h2>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-color)' }}>
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
                padding: '28px 16px 20px',
                borderBottom: '1px solid var(--border-color)',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                position: 'relative',
                cursor: 'default',
                opacity: 0,
                transform: 'translateY(24px)',
                transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s`,
              }}
            >
              {/* Effect 3: Animated Progress Line — grows left-to-right on hover */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '2px',
                width: hoveredRow === i ? '100%' : '0%',
                background: 'var(--grad-accent)',
                transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
                borderRadius: '1px',
              }} />

              {/* Effect 2: Sound Pulse — expanding concentric rings from number on hover */}
              <div style={{ position: 'relative', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {hoveredRow === i && <>
                  <div className="pulse-ring pulse-ring-1" />
                  <div className="pulse-ring pulse-ring-2" />
                </>}
                <span style={{
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-primary)',
                  fontWeight: '700',
                  position: 'relative',
                  zIndex: 1,
                }}>{item.num}</span>
              </div>

              {/* Title + Effect 4: Speaker Equalizer bars */}
              <div style={{ minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{
                  fontSize: '1.1rem',
                  fontFamily: 'var(--font-serif)',
                  textTransform: 'uppercase',
                  fontWeight: '700',
                  color: hoveredRow === i ? 'var(--color-primary)' : 'var(--text-primary)',
                  transition: 'color 0.3s ease',
                }}>{item.title}</span>
                {/* Effect 4: Equalizer bars — always animating, more vivid on hover */}
                <div className={`eq-bars ${hoveredRow === i ? 'eq-active' : ''}`} aria-hidden="true">
                  {[3,5,8,6,4,7,5,3,6,4].map((h, bi) => (
                    <div key={bi} className="eq-bar" style={{ '--eq-h': `${h * 2}px`, animationDelay: `${bi * 0.07}s` }} />
                  ))}
                </div>
              </div>

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
