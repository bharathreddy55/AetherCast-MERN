import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../context/AuthContext';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import './Pages.css';

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/verify-email/${token}`);
        const data = await res.json();
        
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.message || 'Verification link is invalid or expired.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Could not connect to verification servers.');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="auth-page animate-fade-in">
      <div className="auth-card glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
        
        {status === 'verifying' && (
          <div>
            <Loader2 size={48} className="animate-spin" style={{ color: 'var(--color-secondary)', margin: '0 auto 20px auto' }} />
            <h3>Verifying Email</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Please wait while we activate your account...</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <CheckCircle size={48} style={{ color: '#10b981', margin: '0 auto 20px auto' }} />
            <h3 style={{ color: '#ffffff' }}>Account Activated!</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '24px' }}>{message}</p>
            <Link to="/login" className="btn-primary">Sign In</Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <XCircle size={48} style={{ color: '#ef4444', margin: '0 auto 20px auto' }} />
            <h3 style={{ color: '#ffffff' }}>Activation Failed</h3>
            <p style={{ color: '#f87171', marginTop: '8px', marginBottom: '24px' }}>{message}</p>
            <Link to="/login" className="btn-secondary">Back to Login</Link>
          </div>
        )}

      </div>
    </div>
  );
}
