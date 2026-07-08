import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Disc, Layers, Play } from 'lucide-react';
import './PodcastCard.css';

export default function PodcastCard({ podcast }) {
  return (
    <div className="podcast-card glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
      <Link to={`/podcast/${podcast._id}`} style={{ display: 'block', flexGrow: 1, padding: '16px' }}>
        <div className="card-image-container">
          {podcast.coverImage ? (
            <img src={`http://localhost:5000${podcast.coverImage}`} alt={podcast.title} className="card-cover-image" />
          ) : (
            <div className="card-cover-placeholder">
              <Disc size={40} className="card-placeholder-icon" />
            </div>
          )}
          <div className="card-badge">{podcast.category}</div>
          <div className="card-play-overlay">
            <div className="card-play-btn">
              <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />
            </div>
          </div>
        </div>
        <div className="card-content" style={{ padding: '12px 0 0 0' }}>
          <h4 className="card-title">{podcast.title}</h4>
          <p className="card-creator">by {podcast.creatorId?.name || 'Unknown'}</p>
          <div className="card-stats">
            <span className="card-stat-item">
              <Users size={14} />
              <span>{podcast.followersCount} followers</span>
            </span>
            <span className="card-stat-item">
              <Layers size={14} />
              <span>{podcast.episodeCount} episodes</span>
            </span>
          </div>
        </div>
      </Link>

      {podcast.matchedEpisodes && podcast.matchedEpisodes.length > 0 && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255, 255, 255, 0.02)', fontSize: '0.72rem', borderRadius: '0 0 16px 16px' }}>
          <p style={{ color: 'var(--color-secondary)', fontWeight: '600', marginBottom: '4px' }}>Matched in episode transcripts:</p>
          {podcast.matchedEpisodes.slice(0, 2).map((ep) => (
            <div key={ep._id} style={{ marginTop: '6px', lineHeight: '1.3' }}>
              <span style={{ color: '#ffffff', fontWeight: '500' }}>{ep.title}: </span>
              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{ep.snippet || '...'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
