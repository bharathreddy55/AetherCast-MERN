import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Star, MessageSquare, Flag } from 'lucide-react';
import './RatingWidget.css';

export default function RatingWidget({ podcastId, onChange }) {
  const { token, getAuthHeaders, user } = useAuth();
  
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/podcasts/${podcastId}/reviews`);
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews);
      }
    } catch (err) {
      console.error('Failed to load reviews', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [podcastId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/podcasts/${podcastId}/reviews`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rating, comment: reviewText }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh reviews list
        fetchReviews();
        setReviewText('');
        if (onChange) onChange(); // Trigger parent reload (e.g., refresh podcast average rating stats)
      }
    } catch (err) {
      console.error('Failed to submit review', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFlag = async (reviewId) => {
    if (!window.confirm('Flag this review as inappropriate?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/podcasts/${podcastId}/reviews/${reviewId}/flag`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        alert('Review has been flagged. Thank you for keeping the community safe!');
      }
    } catch (err) {
      console.error('Failed to flag review', err);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="rating-widget glass-panel">
      <h3>Reviews & Ratings</h3>
      
      {/* Review Submission Form */}
      {token ? (
        <form onSubmit={handleSubmit} className="review-form">
          <div className="rating-stars-picker">
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Your Rating:</span>
            <div className="stars-row">
              {[1, 2, 3, 4, 5].map((starValue) => {
                const isSelected = starValue <= (hoverRating || rating);
                return (
                  <button
                    key={starValue}
                    type="button"
                    onClick={() => setRating(starValue)}
                    onMouseEnter={() => setHoverRating(starValue)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="star-pick-btn"
                  >
                    <Star
                      size={20}
                      fill={isSelected ? '#fbbf24' : 'none'}
                      color={isSelected ? '#fbbf24' : 'var(--text-muted)'}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group" style={{ margin: '12px 0' }}>
            <textarea
              placeholder="Write an optional review..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="form-input review-textarea"
              rows="2"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            Submit Review
          </button>
        </form>
      ) : (
        <p className="login-prompt">Please log in to rate and review this podcast show.</p>
      )}

      {/* Reviews List */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '20px' }}>Loading reviews...</div>
      ) : reviews.length > 0 ? (
        <div className="reviews-list">
          {reviews.map((rev) => (
            <div key={rev._id} className="review-item">
              <div className="review-item-header">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div className="review-avatar">
                    {rev.userId?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="review-username">{rev.userId?.name}</span>
                    <div className="stars-row" style={{ marginTop: '2px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={12}
                          fill={star <= rev.rating ? '#fbbf24' : 'none'}
                          color={star <= rev.rating ? '#fbbf24' : 'var(--text-muted)'}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="review-date" style={{ marginRight: '8px' }}>{formatDate(rev.createdAt)}</span>
                  {token && user && rev.userId?._id !== user.id && rev.userId?._id !== user._id && (
                    <button
                      onClick={() => handleFlag(rev._id)}
                      style={{ background: 'none', border: 0, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Flag Review"
                    >
                      <Flag size={12} />
                    </button>
                  )}
                </div>
              </div>
              {rev.comment && <p className="review-comment-body">{rev.comment}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-reviews">No reviews yet. Share your feedback!</div>
      )}
    </div>
  );
}
