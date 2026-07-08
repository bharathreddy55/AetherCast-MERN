import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Send, Trash2, MessageSquare, Flag } from 'lucide-react';
import './CommentsSection.css';

export default function CommentsSection({ episodeId }) {
  const { token, getAuthHeaders, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/episodes/${episodeId}/comments`);
      const data = await res.json();
      if (data.success) {
        setComments(data.comments);
      }
    } catch (err) {
      console.error('Failed to load comments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [episodeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/episodes/${episodeId}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: newComment }),
      });
      const data = await res.json();
      if (data.success) {
        // Prepend comment to the list
        setComments((prev) => [data.comment, ...prev]);
        setNewComment('');
      }
    } catch (err) {
      console.error('Failed to add comment', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
      }
    } catch (err) {
      console.error('Failed to delete comment', err);
    }
  };

  const handleFlag = async (commentId) => {
    if (!window.confirm('Flag this comment as inappropriate?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/comments/${commentId}/flag`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        alert('Comment has been flagged. Thank you for keeping the community safe!');
      }
    } catch (err) {
      console.error('Failed to flag comment', err);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="comments-section glass-panel">
      <div className="comments-header">
        <MessageSquare size={16} className="comments-header-icon" />
        <h4>Discussion ({comments.length})</h4>
      </div>

      {/* Add Comment Input */}
      {token ? (
        <form onSubmit={handleSubmit} className="comment-form">
          <input
            type="text"
            placeholder="Share your thoughts on this episode..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="comment-input"
            required
          />
          <button type="submit" disabled={submitting} className="comment-send-btn">
            <Send size={16} />
          </button>
        </form>
      ) : (
        <p className="login-prompt">Please log in to participate in the discussion.</p>
      )}

      {/* Comments List */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading comments...</div>
      ) : comments.length > 0 ? (
        <div className="comments-list">
          {comments.map((comment) => {
            const isOwner = user && comment.userId?._id === user.id;
            const isAdmin = user && user.role === 'admin';

            return (
              <div key={comment._id} className="comment-item">
                {comment.userId?.avatar ? (
                  <img
                    src={window.getMediaUrl(comment.userId.avatar)}
                    alt="Avatar"
                    className="comment-avatar"
                  />
                ) : (
                  <div className="comment-avatar-placeholder">
                    {comment.userId?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                
                <div className="comment-content-wrap">
                  <div className="comment-meta">
                    <span className="comment-author">{comment.userId?.name || 'Deleted User'}</span>
                    <span className="comment-date">{formatDate(comment.createdAt)}</span>
                  </div>
                  <p className="comment-body">{comment.content}</p>
                </div>

                {token && !isOwner && (
                  <button
                    onClick={() => handleFlag(comment._id)}
                    className="comment-delete-btn"
                    style={{ marginRight: '8px', color: 'var(--text-secondary)' }}
                    title="Flag Comment"
                  >
                    <Flag size={14} />
                  </button>
                )}

                {(isOwner || isAdmin) && (
                  <button
                    onClick={() => handleDelete(comment._id)}
                    className="comment-delete-btn"
                    title="Delete Comment"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-comments">Be the first to leave a comment!</div>
      )}
    </div>
  );
}
