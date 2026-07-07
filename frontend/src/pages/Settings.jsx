import React, { useState } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sliders, User, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import './Pages.css';

export default function Settings() {
  const { user, token, updateLocalUser } = useAuth();
  const { accent, setAccent, opacity, setOpacity, blur, setBlur } = useTheme();

  // Profile Form States
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar ? `http://localhost:5000${user.avatar}` : null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('bio', bio);
    if (avatar) {
      formData.append('avatar', avatar);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Profile updated successfully!');
        updateLocalUser(data.user);
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (err) {
      setError('Server connection failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="settings-page animate-fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h2>Preferences & Account</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
          Customize your workspace experience and configure your account details.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', alignItems: 'start' }}>
        {/* Panel 1: Theme Studio */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <Sliders size={20} style={{ color: 'var(--color-primary-hover)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>Theme Studio</h3>
          </div>

          {/* Accent color picker */}
          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Accent Color Theme</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              {[
                { key: 'purple', name: 'Neon Purple', color: '#9333ea' },
                { key: 'cyan', name: 'Vibrant Cyan', color: '#0891b2' },
                { key: 'emerald', name: 'Emerald Green', color: '#10b981' },
                { key: 'orange', name: 'Electric Orange', color: '#ea580c' }
              ].map((th) => (
                <button
                  key={th.key}
                  onClick={() => setAccent(th.key)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: th.color,
                    border: accent === th.key ? '3px solid #ffffff' : 'none',
                    boxShadow: accent === th.key ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  title={th.name}
                />
              ))}
            </div>
          </div>

          {/* Opacity slider */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>Glass Translucency</label>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.85"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary-hover)', cursor: 'pointer' }}
            />
          </div>

          {/* Blur slider */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>Backdrop Blur Radius</label>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{blur}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={blur}
              onChange={(e) => setBlur(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary-hover)', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Panel 2: Profile Settings */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <User size={20} style={{ color: 'var(--color-secondary)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>Account Profile</h3>
          </div>

          {error && (
            <div className="auth-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="auth-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit}>
            {/* Avatar Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar Preview"
                  style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.08)' }}
                />
              ) : (
                <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <User size={30} />
                </div>
              )}

              <div className="file-input-wrapper" style={{ flexGrow: 1, padding: '12px' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="file-input-hidden"
                />
                <div className="file-input-label" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  <Upload size={16} className="file-input-icon" />
                  <span>Choose Avatar</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Biography</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others about yourself..."
                className="form-input"
                rows="3"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}
            >
              <span>{submitting ? 'Saving changes...' : 'Save Profile Details'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
