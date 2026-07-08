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
    <div className="landing-page animate-fade-in" style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 24px' }}>
      
      {/* Centralized Console Header Stack */}
      <header className="hero-section" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '60px 20px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>[ AETHERCAST HUB ]</span>
        <h1 className="hero-title" style={{ fontSize: '3.75rem', fontWeight: '800', lineHeight: '1.1', textTransform: 'uppercase', fontFamily: 'var(--font-serif)', letterSpacing: '0.04em', margin: '20px 0' }}>
          Immerse Yourself in <br />
          <span style={{ color: 'var(--color-primary)' }}>Infinite Soundscapes</span>
        </h1>
        <p className="hero-subtitle" style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '680px', margin: '0 auto 30px auto', lineHeight: '1.6' }}>
          A premium podcast ecosystem for independent creators and passionate listeners. 
          Stream high-fidelity episodes, follow your favorites, and save your progress on the fly.
        </p>
        <div className="hero-cta-buttons" style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
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
        <div style={{ width: '100%', height: '320px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginTop: '48px', position: 'relative', border: '1px solid var(--border-color)' }}>
          <div style={{ width: '100%', height: '100%', backgroundImage: "url('https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=1200&auto=format&fit=crop')", backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.5)' }}></div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,12,0.95), transparent)' }}></div>
        </div>
      </header>

      {/* Rhythmic Category Vertical List Overlay */}
      <section style={{ padding: '60px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>[ POPULAR CHANNELS ]</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px', fontSize: '1.85rem', fontFamily: 'var(--font-serif)', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
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
      <section className="featured-section" style={{ padding: '60px 0', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trending Broadcasts</h2>
          </div>
          <Link to="/explore" className="view-all-link" style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>VIEW ALL</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="loading-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton-card glass-panel" style={{ height: '300px' }}></div>
            ))}
          </div>
        ) : podcasts.length > 0 ? (
          <>
            <div className="trending-stack" style={{ marginBottom: '40px' }}>
              {podcasts.slice(0, 4).map((podcast, idx) => (
                <Link
                  key={podcast._id}
                  to={`/podcast/${podcast._id}`}
                  className="trending-stack-item"
                  style={{ transitionDelay: `${(idx + 1) * 50}ms`, '--i': idx + 1 }}
                >
                  <span className="ts-idx">{String(idx + 1).padStart(2, '0')}</span>
                  {podcast.coverImage ? (
                    <img src={`window.BACKEND_URL${podcast.coverImage}`} alt={podcast.title} />
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

            {podcasts.length > 4 && (
              <div className="podcast-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '28px' }}>
                {podcasts.slice(4).map((podcast) => (
                  <PodcastCard key={podcast._id} podcast={podcast} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
            <h3>No podcasts found</h3>
            <p style={{ color: 'var(--text-secondary)', margin: '12px 0' }}>Become the first creator by registering and uploading your series!</p>
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
          <div style={{ display: 'flex', padding: '24px 12px', borderBottom: '1px solid var(--border-color)', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', minWidth: '40px' }}>01</span>
            <span style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', fontWeight: '700', minWidth: '240px' }}>Smart Playback Engine</span>
            <p style={{ color: 'var(--text-secondary)', flexGrow: 1, fontSize: '0.95rem', margin: 0 }}>Pause on any device and resume from the exact microsecond. Our sync engine ensures you never lose your spot.</p>
          </div>
          
          <div style={{ display: 'flex', padding: '24px 12px', borderBottom: '1px solid var(--border-color)', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', minWidth: '40px' }}>02</span>
            <span style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', fontWeight: '700', minWidth: '240px' }}>Creator Workspaces</span>
            <p style={{ color: 'var(--text-secondary)', flexGrow: 1, fontSize: '0.95rem', margin: 0 }}>Upload files seamlessly, manage draft episodes, check listener statistics, and publish to the global audio-verse.</p>
          </div>

          <div style={{ display: 'flex', padding: '24px 12px', borderBottom: '1px solid var(--border-color)', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', minWidth: '40px' }}>03</span>
            <span style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', fontWeight: '700', minWidth: '240px' }}>Interactive Transcripts</span>
            <p style={{ color: 'var(--text-secondary)', flexGrow: 1, fontSize: '0.95rem', margin: 0 }}>Explore episodes with live, interactive speech transcripts that synchronize instantly during playback.</p>
          </div>
        </div>
      </section>

    </div>
  );
}
