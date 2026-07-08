import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext(null);

export const BACKEND_URL = import.meta.env.VITE_API_URL || 'window.BACKEND_URL';
export const API_BASE_URL = `${BACKEND_URL}/api`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync session from Supabase
  const syncUserSession = async (session) => {
    if (session) {
      const accessToken = session.access_token;
      setToken(accessToken);
      localStorage.setItem('token', accessToken);

      try {
        // Fetch MongoDB profile from backend, which automatically registers them if new
        const res = await fetch(`${API_BASE_URL}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = await res.json();
        if (data.success) {
          setUser({
            ...data.user,
            id: data.user.id || data.user._id,
            _id: data.user._id || data.user.id
          });
        }
      } catch (err) {
        console.error('Failed to sync profile with MongoDB', err);
      }
    } else {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
    }
  };

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUserSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUserSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      // Session synced automatically via listener
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const register = async (username, name, email, password, role, bio) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            username,
            role,
            bio
          },
        },
      });

      if (error) throw error;

      // If email confirmation is required, they must confirm it. Otherwise session is returned.
      if (data.session) {
        // Sync custom role & bio details to backend
        await fetch(`${API_BASE_URL}/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ name, bio, role }),
        });
      }

      return { 
        success: true, 
        requireConfirm: !data.session, 
        message: data.session ? 'Signup complete!' : 'Please check your email to confirm registration.' 
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

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

  // Stub handlers to prevent page errors
  const verifyOtp = async () => ({ success: true });
  const resendOtp = async () => ({ success: true });

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
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
