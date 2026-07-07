import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import './Pages.css';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/explore');
    }
  }, [user, navigate]);
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') || 'listener';

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(defaultRole);
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    const result = await register(username, name, email, password, role, bio);
    setSubmitting(false);

    if (result.success) {
      if (result.requireConfirm) {
        setSuccess(result.message || 'Please check your email to verify your registration.');
      } else {
        navigate('/explore', { state: { showWelcome: true } });
      }
    } else {
      setError(result.message || 'Registration failed');
    }
  };

  return (
    <div className="auth-page animate-fade-in">
      <div className="auth-card glass-panel" style={{ maxWidth: '500px' }}>
        <div className="auth-header">
          <h2>Create Account</h2>
          <p>Join AetherCast and start streaming</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-error" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-double-col">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                required
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                required
                placeholder="janedoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              required
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="•••••••• (6+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 0,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">I want to...</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-input"
              style={{ background: 'rgba(10, 7, 30, 0.9)' }}
            >
              <option value="listener">Listen to Podcasts</option>
              <option value="creator">Publish Podcasts (Creator)</option>
            </select>
          </div>

          {role === 'creator' && (
            <div className="form-group">
              <label className="form-label">Creator Biography</label>
              <textarea
                placeholder="Tell listeners about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="form-input"
                rows="2"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary auth-btn"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <UserPlus size={18} />
            <span>{submitting ? 'Creating account...' : 'Create Account'}</span>
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
