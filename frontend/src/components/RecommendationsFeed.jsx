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
      <div className="loading-grid">
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton-card glass-panel" style={{ height: '300px', borderRadius: '16px' }}></div>
        ))}
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <section className="recommendations-feed-section" style={{ marginBottom: '48px' }}>
      <div className="section-header" style={{ marginTop: 0 }}>
        <div className="section-title-wrap">
          <Sparkles size={20} className="title-icon" style={{ color: 'var(--color-secondary)' }} />
          <h3>Smart Recommendations</h3>
        </div>
      </div>

      <div className="podcast-grid">
        {recommendations.map((podcast) => (
          <PodcastCard key={podcast._id} podcast={podcast} />
        ))}
      </div>
    </section>
  );
}
