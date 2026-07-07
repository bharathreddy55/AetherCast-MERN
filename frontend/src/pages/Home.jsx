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
    <div className="home-page animate-fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h2>Welcome back, <span className="gradient-text">{user?.name}</span></h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
          Here is your personalized feed. Pick up where you left off or explore followed shows.
        </p>
      </header>

      {/* Continue Listening */}
      <section style={{ marginBottom: '48px' }}>
        <div className="section-header" style={{ marginTop: 0 }}>
          <div className="section-title-wrap">
            <Radio size={20} className="title-icon" />
            <h3>Continue Listening</h3>
          </div>
        </div>

        {loadingContinue ? (
          <div className="loading-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {[1, 2].map((n) => (
              <div key={n} className="skeleton-card glass-panel" style={{ height: '90px', borderRadius: '12px' }}></div>
            ))}
          </div>
        ) : continueList.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {continueList.map((progress) => {
              const ep = progress.episodeId;
              if (!ep) return null;
              const percent = Math.min(100, Math.round((progress.position / progress.duration) * 100));
              
              return (
                <div key={progress._id} className="glass-panel" style={{ display: 'flex', padding: '16px', gap: '16px', borderRadius: '14px', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                  <img 
                    src={ep.podcastId?.coverImage ? `http://localhost:5000${ep.podcastId.coverImage}` : ''} 
                    alt="Cover" 
                    style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }}
                  />
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{ep.podcastId?.title}</p>
                    
                    {/* Progress Bar */}
                    <div style={{ background: 'rgba(255,255,255,0.08)', height: '4px', borderRadius: '2px', marginTop: '10px', position: 'relative' }}>
                      <div style={{ background: 'var(--grad-accent)', width: `${percent}%`, height: '100%', borderRadius: '2px' }}></div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      {percent}% completed
                    </span>
                  </div>

                  <button 
                    onClick={() => playEpisode(ep)}
                    className="play-row-btn"
                    style={{ flexShrink: 0 }}
                  >
                    <Play size={16} fill="currentColor" style={{ marginLeft: '1px' }} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state glass-panel" style={{ padding: '30px' }}>
            <p>No episodes in progress. Start streaming to track your history!</p>
          </div>
        )}
      </section>

      {/* Recommendations Feed */}
      <RecommendationsFeed />

      {/* Followed Podcasts */}
      <section>
        <div className="section-header">
          <div className="section-title-wrap">
            <Bookmark size={20} className="title-icon" />
            <h3>Your Followed Shows</h3>
          </div>
        </div>

        {loadingFollowed ? (
          <div className="loading-grid">
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton-card glass-panel" style={{ borderRadius: '16px' }}></div>
            ))}
          </div>
        ) : followedPodcasts.length > 0 ? (
          <div className="podcast-grid">
            {followedPodcasts.map((podcast) => (
              <PodcastCard key={podcast._id} podcast={podcast} />
            ))}
          </div>
        ) : (
          <div className="empty-state glass-panel" style={{ padding: '40px' }}>
            <p>You aren't following any podcasts yet. Explore and find shows you like!</p>
          </div>
        )}
      </section>
    </div>
  );
}
