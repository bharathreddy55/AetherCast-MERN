import React, { useState } from 'react';
import { X, Search, Replace, Save, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../context/AuthContext';

export default function TranscriptEditorModal({ episode, token, onClose, onSaveSuccess }) {
  const [transcript, setTranscript] = useState(episode.transcript || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSearchAndReplace = () => {
    if (!searchQuery) return;
    // Replace all occurrences case-insensitively
    const escapedSearch = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedSearch, 'gi');
    const updated = transcript.replace(regex, replaceQuery);
    setTranscript(updated);
  };

  const validateTranscript = () => {
    // Basic verification: Check if it has any timestamps formatted like [MM:SS]
    const lines = transcript.split('\n');
    const timestampRegex = /^\[\d{2}:\d{2}\]/;
    const missingTimestamps = lines.filter(line => line.trim() && !timestampRegex.test(line));

    if (missingTimestamps.length > 0) {
      setError(`Warning: ${missingTimestamps.length} line(s) are missing timestamps (e.g. [00:00]). Subtitles might not sync properly.`);
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/episodes/${episode._id}/transcript`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ transcript })
      });
      const data = await res.json();
      if (data.success) {
        alert('Transcript saved successfully!');
        if (onSaveSuccess) onSaveSuccess(data.transcript);
        onClose();
      } else {
        setError(data.message || 'Failed to save transcript');
      }
    } catch (err) {
      console.error(err);
      setError('Network error saving transcript');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999
    }}>
      <div className="glass-panel animate-scale-in" style={{
        padding: '28px',
        borderRadius: '16px',
        maxWidth: '700px',
        width: '90%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff' }}>Interactive Transcript Editor</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Episode: {episode.title}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 0, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Search and Replace utility bar */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '16px', 
          background: 'rgba(0,0,0,0.2)', 
          padding: '12px', 
          borderRadius: '8px', 
          border: '1px solid rgba(255,255,255,0.03)',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexGrow: 1 }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Find text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '0.8rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexGrow: 1 }}>
            <Replace size={14} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '0.8rem'
              }}
            />
          </div>
          <button 
            onClick={handleSearchAndReplace}
            disabled={!searchQuery}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', height: '32px' }}
          >
            Replace All
          </button>
        </div>

        {/* Subtitle Tips alert */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>
          <AlertCircle size={16} style={{ color: '#06b6d4' }} />
          <span style={{ fontSize: '0.75rem', color: '#06b6d4', textAlign: 'left' }}>
            Timestamps must follow the format <code>[MM:SS] Text</code> (e.g. <code>[01:24] Hello world</code>) for syncing to work.
          </span>
        </div>

        {/* Text Area */}
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
          <textarea
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setError('');
            }}
            placeholder="[00:00] First subtitle line&#10;[00:15] Second subtitle line..."
            style={{
              width: '100%',
              flexGrow: 1,
              height: '35vh',
              minHeight: '200px',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              lineHeight: '1.5',
              resize: 'none'
            }}
          />
        </div>

        {/* Error Warning */}
        {error && (
          <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '0 0 16px 0', textAlign: 'left' }}>
            {error}
          </p>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            className="btn-secondary" 
            style={{ padding: '8px 20px', borderRadius: '50px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              validateTranscript();
              handleSave();
            }}
            disabled={saving}
            className="btn-primary" 
            style={{ padding: '8px 20px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Transcript'}
          </button>
        </div>
      </div>
    </div>
  );
}
