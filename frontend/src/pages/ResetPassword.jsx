import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import './Pages.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    // Call Supabase API to update user password
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Password updated successfully! Redirecting to login page...');
      setTimeout(() => navigate('/login'), 2500);
    }
  };

  return (
    <div className="auth-page animate-fade-in">
      <div className="auth-card glass-panel" style={{ maxWidth: '400px' }}>
        <div className="auth-header">
          <h2>Reset Password</h2>
          <p>Please enter your new secure account password below</p>
        </div>

        {error && (
          <div className="auth-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">New Password</label>
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

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary auth-btn"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Lock size={18} />
            <span>{submitting ? 'Updating Password...' : 'Update Password'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
