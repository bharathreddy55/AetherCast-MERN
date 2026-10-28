import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { clearDownloads } from '../lib/downloads';
import { supabase } from '../supabase';
import { API_BASE_URL } from '../lib/config';
export { BACKEND_URL, API_BASE_URL } from '../lib/config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const downloadOwnerRef = useRef(null);

  useEffect(() => {
    let active = true;
    let revision = 0;
    let controller;

    const syncUserSession = async (session) => {
      if (!active) return;
      const currentRevision = ++revision;
      controller?.abort();
      controller = new AbortController();
      setLoading(true);
      setAuthError('');
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');

      try {
        if (!session) {
          const previousOwner = downloadOwnerRef.current;
          downloadOwnerRef.current = null;
          if (previousOwner) void clearDownloads(previousOwner).catch(() => console.warn('Unable to clear browser downloads. Clear site data on a shared device.'));
          return;
        }
        const res = await fetch(`${API_BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'error',
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.user) {
          throw new Error(data.message || 'Unable to load your private library profile. Please sign in again.');
        }
        if (!active || currentRevision !== revision) return;
        setUser({ ...data.user, id: data.user.id || data.user._id, _id: data.user._id || data.user.id });
        downloadOwnerRef.current = data.user.id || data.user._id;
        setToken(session.access_token);
        localStorage.setItem('token', session.access_token);
      } catch (error) {
        if (active && currentRevision === revision && error.name !== 'AbortError') {
          setAuthError(error.message || 'Unable to load your private library. Please try again.');
        }
      } finally {
        if (active && currentRevision === revision) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Password recovery must remain on its recovery page.
      if (event !== 'PASSWORD_RECOVERY') void syncUserSession(session);
    });
    const initialRevision = revision;
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active || revision !== initialRevision) return;
      if (error) {
        setAuthError(error.message);
        setLoading(false);
      } else {
        void syncUserSession(session);
      }
    }).catch(() => {
      if (active && revision === initialRevision) {
        setAuthError('Unable to restore your session. Please sign in again.');
        setLoading(false);
      }
    });

    return () => {
      active = false;
      controller?.abort();
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      // Session synced automatically via listener
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const register = async () => ({
    success: false,
    message: 'This is a private library. Public registration is disabled.',
  });

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/home',
        }
      });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const logout = async () => {
    try {
      window.dispatchEvent(new Event('library-before-logout'));
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const updateLocalUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const getAuthHeaders = () => {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const verifyOtp = register;
  const resendOtp = register;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authError,
        login,
        register,
        logout,
        loginWithGoogle,
        verifyOtp,
        resendOtp,
        updateLocalUser,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
