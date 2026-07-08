import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Disc, Layers, Play } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { API_BASE_URL, BACKEND_URL } from '../context/AuthContext';
import './PodcastCard.css';

export default function PodcastCard({ podcast }) {
  const { playEpisode } = usePlayer();

  const handlePlayClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE_URL}/podcasts/${podcast._id}/episodes`);
      const data = await res.json();
      if (data.success && data.episodes && data.episodes.length > 0) {
        playEpisode(data.episodes[0]);
      }
    } catch (err) {
      console.error('Failed to fetch episodes for playback', err);
    }
  };

  const getCoverImage = () => {
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
    <div className="podcast-card glass-panel animate-fade-in">
      <Link to={`/podcast/${podcast._id}`} className="card-click-area">
        {/* Background cover image */}
        <div 
          className="card-bg-image" 
          style={{ backgroundImage: `url(${getCoverImage()})` }}
        />
        <div className="card-blur-overlay"></div>

        {/* Top category badge */}
        <div className="card-badge">{podcast.category}</div>

        {/* Play button overlay */}
        <div className="card-play-overlay">
          <div className="card-play-btn" onClick={handlePlayClick}>
            <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />
          </div>
        </div>

        {/* Footer housing the curved SVG and info content */}
        <div className="card-footer">
          <svg id="curve" viewBox="0 0 400 450" preserveAspectRatio="none">
            <path 
              id={"p-" + podcast._id} 
              d="M0,200 Q80,100 400,200 V150 H0 V50" 
              transform="translate(0 300)" 
            />
            <rect 
              id={"dummyRect-" + podcast._id} 
              x="0" 
              y="0" 
              height="450" 
              width="400" 
              fill="transparent" 
            />
            {/* slide up */}
            <animate 
              xlinkHref={"#p-" + podcast._id} 
              attributeName="d" 
              to="M0,50 Q80,100 400,50 V150 H0 V50" 
              fill="freeze" 
              begin={`dummyRect-${podcast._id}.mouseover`} 
              end={`dummyRect-${podcast._id}.mouseout`} 
              dur="0.1s" 
              id={"bounce1-" + podcast._id} 
            />
            {/* slide up and curve in */}
            <animate 
              xlinkHref={"#p-" + podcast._id} 
              attributeName="d" 
              to="M0,50 Q80,0 400,50 V150 H0 V50" 
              fill="freeze" 
              begin={`bounce1-${podcast._id}.end`} 
              end={`dummyRect-${podcast._id}.mouseout`} 
              dur="0.15s" 
              id={"bounce2-" + podcast._id} 
            />
            {/* slide down and curve in */}
            <animate 
              xlinkHref={"#p-" + podcast._id} 
              attributeName="d" 
              to="M0,50 Q80,80 400,50 V150 H0 V50" 
              fill="freeze" 
              begin={`bounce2-${podcast._id}.end`} 
              end={`dummyRect-${podcast._id}.mouseout`} 
              dur="0.15s" 
              id={"bounce3-" + podcast._id} 
            />
            {/* slide down and curve out */}
            <animate 
              xlinkHref={"#p-" + podcast._id} 
              attributeName="d" 
              to="M0,50 Q80,45 400,50 V150 H0 V50" 
              fill="freeze" 
              begin={`bounce3-${podcast._id}.end`} 
              end={`dummyRect-${podcast._id}.mouseout`} 
              dur="0.1s" 
              id={"bounce4-" + podcast._id} 
            />
            {/* curve in */}
            <animate 
              xlinkHref={"#p-" + podcast._id} 
              attributeName="d" 
              to="M0,50 Q80,50 400,50 V150 H0 V50" 
              fill="freeze" 
              begin={`bounce4-${podcast._id}.end`} 
              end={`dummyRect-${podcast._id}.mouseout`} 
              dur="0.05s" 
              id={"bounce5-" + podcast._id} 
            />
            <animate 
              xlinkHref={"#p-" + podcast._id} 
              attributeName="d" 
              to="M0,200 Q80,100 400,200 V150 H0 V50" 
              fill="freeze" 
              begin={`dummyRect-${podcast._id}.mouseout`} 
              dur="0.15s" 
              id={"bounceOut-" + podcast._id} 
            />
          </svg>

          {/* Info content that slides up */}
          <div className="card-info-content">
            <h4 className="card-title">{podcast.title}</h4>
            <p className="card-creator">by {podcast.creatorId?.name || 'Unknown'}</p>
            <div className="card-stats">
              <span className="card-stat-item">
                <Users size={14} />
                <span>{podcast.followersCount}</span>
              </span>
              <span className="card-stat-item">
                <Layers size={14} />
                <span>{podcast.episodeCount} eps</span>
              </span>
            </div>

            {/* Matched episodes query snippet (if any) */}
            {podcast.matchedEpisodes && podcast.matchedEpisodes.length > 0 && (
              <div className="card-matched-snippet">
                {podcast.matchedEpisodes.slice(0, 1).map((ep) => (
                  <div key={ep._id} className="matched-snippet-row">
                    <span className="matched-snippet-label">Matched: </span>
                    <span className="matched-snippet-text">{ep.snippet || '...'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

