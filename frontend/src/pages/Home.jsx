import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { Music, Play, Radio, Bookmark } from 'lucide-react';
import PodcastCard from '../components/PodcastCard';
import RecommendationsFeed from '../components/RecommendationsFeed';
import './Pages.css';

export default function Home() {
  const { token, getAuthHeaders, user } = useAuth();
  const { playEpisode } = usePlayer();
  
  const [continueList, setContinueList] = useState([]);
  const [followedPodcasts, setFollowedPodcasts] = useState([]);
  const [loadingContinue, setLoadingContinue] = useState(true);
  const [loadingFollowed, setLoadingFollowed] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchContinueListening = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/episodes/continue-listening`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (data.success) {
          setContinueList(data.list);
        }
      } catch (err) {
        console.error('Failed to load continue listening', err);
      } finally {
        setLoadingContinue(false);
      }
    };

    const fetchFollowed = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/podcasts/followed`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (data.success) {
          setFollowedPodcasts(data.podcasts);
        }
      } catch (err) {
        console.error('Failed to load followed podcasts', err);
      } finally {
        setLoadingFollowed(false);
      }
    };

    fetchContinueListening();
    fetchFollowed();
  }, [token]);

  return (
    <div className="home-page animate-fade-in" style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 24px', paddingBottom: '120px' }}>

      {/* Welcome Header */}
      <header style={{ textAlign: 'center', padding: '48px 0', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>[ COMMAND CENTER ]</span>
        <h2 style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '16px' }}>
          Welcome back, <span style={{ color: 'var(--color-primary)' }}>{user?.name}</span>
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '12px', fontFamily: 'var(--font-sans)' }}>
          Pick up where you left off or explore your followed shows.
        </p>
      </header>

      {/* Continue Listening */}
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Radio size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>Continue Listening</h3>
          </div>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>[ RESUME ]</span>
        </div>

        {loadingContinue ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {[1, 2].map((n) => (
              <div key={n} className="skeleton-card glass-panel" style={{ height: '90px', borderRadius: 'var(--radius-md)' }}></div>
            ))}
          </div>
        ) : continueList.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {continueList.map((progress) => {
              const ep = progress.episodeId;
              if (!ep) return null;
              const percent = Math.min(100, Math.round((progress.position / progress.duration) * 100));
              
              return (
                <div key={progress._id} style={{ display: 'flex', padding: '16px', gap: '16px', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', transition: 'var(--transition-smooth)', position: 'relative', overflow: 'hidden' }}>
                  <img 
                    src={ep.podcastId?.coverImage ? `${window.BACKEND_URL}${ep.podcastId.coverImage}` : ''} 
                    alt="Cover" 
                    style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-default)', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                  />
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '0.9rem', fontFamily: 'var(--font-sans)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{ep.podcastId?.title}</p>
                    
                    {/* Progress Bar */}
                    <div style={{ background: 'rgba(255,255,255,0.06)', height: '3px', borderRadius: '2px', marginTop: '10px', position: 'relative' }}>
                      <div style={{ background: 'var(--color-primary)', width: `${percent}%`, height: '100%', borderRadius: '2px', boxShadow: '0 0 8px rgba(255, 122, 0, 0.3)' }}></div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginTop: '4px', letterSpacing: '0.05em' }}>
                      {percent}% COMPLETED
                    </span>
                  </div>

                  <button 
                    onClick={() => playEpisode(ep)}
                    style={{ flexShrink: 0, width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-primary)', color: '#000', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'var(--transition-smooth)', boxShadow: '0 4px 12px rgba(255, 122, 0, 0.25)' }}
                  >
                    <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>NO EPISODES IN PROGRESS — START STREAMING TO TRACK YOUR HISTORY</p>
          </div>
        )}
      </section>

      {/* Recommendations Feed */}
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--border-color)' }}>
        <RecommendationsFeed />
      </section>

      {/* Followed Podcasts */}
      <section style={{ padding: '48px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Bookmark size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>Your Followed Shows</h3>
          </div>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>[ LIBRARY ]</span>
        </div>

        {loadingFollowed ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton-card glass-panel" style={{ borderRadius: 'var(--radius-lg)', height: '300px' }}></div>
            ))}
          </div>
        ) : followedPodcasts.length > 0 ? (
          <div className="podcast-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
            {followedPodcasts.map((podcast) => (
              <PodcastCard key={podcast._id} podcast={podcast} />
            ))}
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>NO FOLLOWED SHOWS YET — EXPLORE AND FIND SHOWS YOU LIKE</p>
          </div>
        )}
      </section>
    </div>
  );
}
