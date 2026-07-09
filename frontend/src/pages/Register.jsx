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
  const [signupCooldown, setSignupCooldown] = useState(0);

  useEffect(() => {
    const limitTime = localStorage.getItem('signUpLimitTime');
    if (limitTime) {
      const elapsed = Math.floor((Date.now() - parseInt(limitTime)) / 1000);
      const remaining = 3600 - elapsed;
      if (remaining > 0) {
        setSignupCooldown(remaining);
      } else {
        localStorage.removeItem('signUpLimitTime');
      }
    }
  }, []);

  useEffect(() => {
    if (signupCooldown > 0) {
      const timer = setTimeout(() => {
        setSignupCooldown(prev => {
          if (prev <= 1) {
            localStorage.removeItem('signUpLimitTime');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [signupCooldown]);

  const formatCooldown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (signupCooldown > 0) return;
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
      if (result.message.toLowerCase().includes('limit exceeded') || result.message.toLowerCase().includes('rate limit')) {
        localStorage.setItem('signUpLimitTime', Date.now().toString());
        setSignupCooldown(3600);
      }
    }
  };

  return (
    <div className="auth-page animate-fade-in">
      <div className="auth-card glass-panel">
        <div className="auth-header">
          <span className="badge-mono">REGISTER</span>
          <h2 className="brand-heading">Create Account</h2>
          <p>Join VOX and start streaming</p>
        </div>

        {signupCooldown > 0 ? (
          <div className="auth-error" style={{ background: 'rgba(255, 122, 0, 0.1)', borderColor: 'rgba(255, 122, 0, 0.2)', color: 'var(--color-primary)' }}>
            Email sending limit exceeded. Signup option refreshes in {formatCooldown(signupCooldown)}.
          </div>
        ) : (
          error && <div className="auth-error">{error}</div>
        )}
        {success && <div className="auth-error" style={{ background: 'rgba(255, 122, 0, 0.08)', borderColor: 'rgba(255, 122, 0, 0.2)', color: 'var(--color-primary)' }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-double-col">
            <div className="form-group">
              <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Full Name</label>
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
              <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Username</label>
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
            <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Email Address</label>
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
            <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Password</label>
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
            <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>I want to...</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-input"
              style={{ background: 'var(--bg-card)' }}
            >
              <option value="listener">Listen to Podcasts</option>
              <option value="creator">Publish Podcasts (Creator)</option>
            </select>
          </div>

          {role === 'creator' && (
            <div className="form-group">
              <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Creator Biography</label>
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
            disabled={submitting || signupCooldown > 0}
            className="btn-primary auth-btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600
            }}
          >
            <UserPlus size={18} />
            <span>{submitting ? 'CREATING ACCOUNT...' : (signupCooldown > 0 ? `LOCKED (${formatCooldown(signupCooldown)})` : 'CREATE ACCOUNT')}</span>
          </button>
        </form>

        <div className="auth-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link" style={{ color: 'var(--color-primary)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
