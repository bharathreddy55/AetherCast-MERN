import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Sparkles } from 'lucide-react';
import PodcastCard from './PodcastCard';
import '../pages/Pages.css';

export default function RecommendationsFeed() {
  const { token, getAuthHeaders } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/recommendations`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (data.success) {
          setRecommendations(data.recommendations);
        }
      } catch (err) {
        console.error('Failed to load recommendations', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchRecommendations();
    }
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton-card glass-panel" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }}></div>
        ))}
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>Smart Recommendations</h3>
        </div>
        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>[ FOR YOU ]</span>
      </div>

      <div className="podcast-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
        {recommendations.map((podcast) => (
          <PodcastCard key={podcast._id} podcast={podcast} />
        ))}
      </div>
    </section>
  );
}

