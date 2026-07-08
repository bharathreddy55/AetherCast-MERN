import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { LogIn, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import './Pages.css';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/explore');
    }
  }, [user, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot Password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(email, password);
    setSubmitting(false);

    if (result.success) {
      navigate('/explore', { state: { showWelcome: true } });
    } else {
      setError(result.message || 'Invalid credentials');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setForgotSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin + '/reset-password',
    });
    setForgotSubmitting(false);

    if (error) {
      setForgotError(error.message);
    } else {
      setForgotSuccess('Password reset link sent to your email inbox!');
    }
  };

  return (
    <div className="auth-page animate-fade-in">
      <div className="auth-card glass-panel">
        <div className="auth-header">
          <span className="badge-mono">SIGN IN</span>
          <h2 className="brand-heading">Welcome Back</h2>
          <p>Sign in to continue to your dashboard</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Email Address</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
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

          {/* Forgot Password link */}
          <div style={{ textAlign: 'right', marginBottom: '24px' }}>
            <button
              type="button"
              onClick={() => {
                setForgotEmail('');
                setForgotError('');
                setForgotSuccess('');
                setShowForgotModal(true);
              }}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary auth-btn"
            style={{ width: '100%', justifyContent: 'center', textTransform: 'uppercase', fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '0.06em', borderRadius: 'var(--radius-default)', boxShadow: '0 4px 16px rgba(255, 122, 0, 0.2)' }}
          >
            <LogIn size={18} />
            <span>{submitting ? 'SIGNING IN...' : 'SIGN IN'}</span>
          </button>
        </form>

        <div className="auth-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <p style={{ fontFamily: 'var(--font-sans)' }}>
            Don't have an account?{' '}
            <Link to="/register" className="auth-link" style={{ color: 'var(--color-primary)' }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="google-modal-overlay">
          <form onSubmit={handleForgotPassword} className="google-modal-content glass-panel animate-scale-up" style={{ maxWidth: '400px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <KeyRound size={20} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '1rem' }}>Reset Password</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.4', fontFamily: 'var(--font-sans)' }}>
              Enter the email address associated with your account, and we will email you a link to reset your password.
            </p>

            {forgotError && (
              <div className="auth-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <AlertCircle size={16} />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="auth-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                <CheckCircle2 size={16} />
                <span>{forgotSuccess}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Email Address</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="form-input"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowForgotModal(false)}
                style={{ padding: '8px 16px', fontSize: '0.9rem', textTransform: 'uppercase', fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '0.04em', borderRadius: 'var(--radius-default)' }}
              >
                CLOSE
              </button>
              <button 
                type="submit" 
                disabled={forgotSubmitting}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.9rem', textTransform: 'uppercase', fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '0.04em', borderRadius: 'var(--radius-default)', boxShadow: '0 4px 16px rgba(255, 122, 0, 0.2)' }}
              >
                {forgotSubmitting ? 'SENDING...' : 'SEND RESET LINK'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
