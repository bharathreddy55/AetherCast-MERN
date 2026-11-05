import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { clearDownloads } from '../lib/downloads';
import { supabase } from '../supabase';
import { API_BASE_URL } from '../lib/config';
import { credentialGate, createCredentialSession } from '../lib/credentialSession';
export { BACKEND_URL, API_BASE_URL } from '../lib/config';

const AuthContext = createContext(null);
const closedRegistration = async () => ({ success: false, message: 'This is a private library. Public registration is disabled.' });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const sessionRef = useRef(null);

  useEffect(() => {
    credentialGate.lock();
    const session = createCredentialSession({ auth: supabase.auth, gate: credentialGate,
      fetchProfile: (accessToken, signal) => fetch(`${API_BASE_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), cache: 'no-store', redirect: 'error',
      }),
      onState: state => { setUser(state.user); setToken(state.token); setLoading(state.loading); setAuthError(state.authError); },
      onSessionEnd: owner => { void clearDownloads(owner).catch(() => console.warn('Unable to clear browser downloads. Clear site data on a shared device.')); },
    });
    sessionRef.current = session;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, value) => session.handleEvent(event, value));
    const lockPage = () => {
      window.dispatchEvent(new Event('library-before-logout'));
      session.lock();
    };
    const restorePage = event => { if (event.persisted) session.lock(); };
    window.addEventListener('pagehide', lockPage);
    window.addEventListener('pageshow', restorePage);
    return () => {
      subscription.unsubscribe(); session.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
      window.removeEventListener('pagehide', lockPage);
      window.removeEventListener('pageshow', restorePage);
    };
  }, []);

  const login = (email, password) => sessionRef.current?.login(email, password)
    || Promise.resolve({ success: false, message: 'Sign-in is initializing. Please try again.' });
  const logout = async () => {
    window.dispatchEvent(new Event('library-before-logout'));
    await sessionRef.current?.logout();
  };
  const updateLocalUser = updated => setUser(previous => previous ? {
    ...previous, ...updated, id: previous.id, _id: previous._id, supabaseUserId: previous.supabaseUserId,
  } : null);
  const loginWithGoogle = async () => ({ success: false, message: 'Sign in with your email and password to access this private library.' });
  const getAuthHeaders = () => ({ ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' });

  return <AuthContext.Provider value={{ user, token, loading, authError, login, logout, updateLocalUser,
    loginWithGoogle, getAuthHeaders, register: closedRegistration, verifyOtp: closedRegistration, resendOtp: closedRegistration }}>
    {children}
  </AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
