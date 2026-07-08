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
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar ? window.getMediaUrl(user.avatar) : null);
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
    <div className="settings-page animate-fade-in" style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px' }}>
      {/* ── Volcanic Header ── */}
      <header style={{ textAlign: 'center', marginBottom: '48px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--color-primary)',
          letterSpacing: '0.2em',
          display: 'block',
          marginBottom: '8px'
        }}>
          [ ACCOUNT SETTINGS ]
        </span>
        <h2 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '2rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
          margin: 0
        }}>
          Preferences &amp; Account
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '0.95rem', marginTop: '10px' }}>
          Customize your workspace experience and configure your account details.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', alignItems: 'start' }}>
        {/* ── Panel 1: Theme Studio ── */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '28px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <Sliders size={20} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.1rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Theme Studio
            </h3>
          </div>

          {/* Accent color picker */}
          <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Accent Color Theme</label>
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
                    borderRadius: 'var(--radius-full, 50%)',
                    background: th.color,
                    border: accent === th.key ? '3px solid var(--color-primary)' : '2px solid var(--border-color)',
                    boxShadow: accent === th.key ? '0 0 12px var(--color-primary)' : 'none',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  title={th.name}
                />
              ))}
            </div>
          </div>

          {/* Opacity slider */}
          <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Glass Translucency</label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-primary)' }}>{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.85"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Blur slider */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Backdrop Blur Radius</label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-primary)' }}>{blur}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={blur}
              onChange={(e) => setBlur(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* ── Panel 2: Profile Settings ── */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '28px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <User size={20} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.1rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Account Profile
            </h3>
          </div>

          {error && (
            <div className="auth-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderRadius: 'var(--radius-md)' }}>
              <AlertCircle size={16} />
              <span style={{ fontFamily: 'var(--font-sans)' }}>{error}</span>
            </div>
          )}

          {success && (
            <div className="auth-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderRadius: 'var(--radius-md)' }}>
              <CheckCircle2 size={16} />
              <span style={{ fontFamily: 'var(--font-sans)' }}>{success}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit}>
            {/* Avatar Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar Preview"
                  style={{ width: '70px', height: '70px', borderRadius: 'var(--radius-full, 50%)', objectFit: 'cover', border: '2px solid var(--border-color)' }}
                />
              ) : (
                <div style={{ width: '70px', height: '70px', borderRadius: 'var(--radius-full, 50%)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
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
                <div className="file-input-label" style={{ padding: '8px 16px', fontSize: '0.85rem', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', borderRadius: 'var(--radius-md)' }}>
                  <Upload size={16} className="file-input-icon" />
                  <span>CHOOSE AVATAR</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
              />
            </div>

            <div className="form-group" style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Biography</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others about yourself..."
                className="form-input"
                rows="3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                marginTop: '4px',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
                fontSize: '0.85rem',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <span>{submitting ? 'SAVING CHANGES...' : 'SAVE PROFILE DETAILS'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
