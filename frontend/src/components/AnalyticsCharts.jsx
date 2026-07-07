import React from 'react';
import { Eye, Heart, Star, BarChart2 } from 'lucide-react';
import '../pages/Pages.css';

export default function AnalyticsCharts({ stats }) {
  if (!stats) return null;

  const {
    totalPlays = 0,
    totalFollowers = 0,
    totalReviews = 0,
    avgRating = 0,
    showsCount = 0,
    episodesCount = 0,
    categoryDistribution = [],
    topEpisodes = [],
  } = stats;

  // Calculate SVG dimensions for the bar chart
  const chartHeight = 150;
  const chartWidth = 500;
  const maxPlays = Math.max(...topEpisodes.map((e) => e.playCount), 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
      {/* Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(147, 51, 234, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--color-primary-hover)' }}>
            <Eye size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Stream Plays</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '2px' }}>{totalPlays.toLocaleString()}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--color-secondary)' }}>
            <Heart size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Subscribers</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '2px' }}>{totalFollowers.toLocaleString()}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '12px', borderRadius: '12px', color: '#fbbf24' }}>
            <Star size={24} fill="#fbbf24" />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Average Ratings</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '2px' }}>
              {avgRating > 0 ? `${avgRating} / 5.0` : 'No reviews'}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Play counts SVG Bar Chart */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <BarChart2 size={18} style={{ color: 'var(--color-primary-hover)' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: '600' }}>Top Episodes Performance</h4>
          </div>

          {topEpisodes.length > 0 ? (
            <div>
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                {topEpisodes.map((ep, i) => {
                  const barWidth = 40;
                  const gap = (chartWidth - barWidth * topEpisodes.length) / (topEpisodes.length + 1);
                  const x = gap + i * (barWidth + gap);
                  const barHeight = (ep.playCount / maxPlays) * (chartHeight - 40);
                  const y = chartHeight - 30 - barHeight;

                  return (
                    <g key={ep._id}>
                      {/* Interactive Bar */}
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        fill="url(#barGrad)"
                        style={{ transition: 'all 0.3s ease' }}
                      />
                      {/* Play count label */}
                      <text
                        x={x + barWidth / 2}
                        y={y - 8}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="10"
                        fontWeight="600"
                      >
                        {ep.playCount}
                      </text>
                      {/* Episode Title (truncated) */}
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight - 12}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        fontSize="9"
                      >
                        {ep.title.length > 8 ? `${ep.title.slice(0, 6)}...` : ep.title}
                      </text>
                    </g>
                  );
                })}
                {/* Baseline */}
                <line x1="0" y1={chartHeight - 25} x2={chartWidth} y2={chartHeight - 25} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                
                {/* Gradients Definitions */}
                <defs>
                  <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-primary-hover)" />
                    <stop offset="100%" stopColor="var(--color-secondary)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No plays recorded yet.
            </div>
          )}
        </div>

        {/* Shows Breakdown and Category Distro */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '16px' }}>Category Distribution</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {categoryDistribution.length > 0 ? (
                categoryDistribution.map((dist, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: idx % 2 === 0 ? 'var(--color-primary-hover)' : 'var(--color-secondary)' }}></span>
                    {dist.category}: {dist.count} shows
                  </span>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No categories registered.</div>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Shows</span>
              <h4 style={{ fontSize: '1.25rem', marginTop: '4px' }}>{showsCount}</h4>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Published Episodes</span>
              <h4 style={{ fontSize: '1.25rem', marginTop: '4px' }}>{episodesCount}</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
