import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlayerProvider } from './context/PlayerContext';
import { ThemeProvider } from './context/ThemeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

import Navbar from './components/Navbar';
import AudioPlayer from './components/AudioPlayer';

import Landing from './pages/Landing';
import Explore from './pages/Explore';
import PodcastDetails from './pages/PodcastDetails';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import CreatorDashboard from './pages/CreatorDashboard';
import Playlists from './pages/Playlists';
import PlaylistDetails from './pages/PlaylistDetails';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import ResetPassword from './pages/ResetPassword';
import ListenHistory from './pages/ListenHistory';
import AdminDashboard from './pages/AdminDashboard';

// Helper for protecting user routes
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading authentication...</div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
}

// Helper for protecting creator routes
function CreatorRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading authentication...</div>
      </div>
    );
  }
  
  return user && user.role === 'creator' ? children : <Navigate to="/" />;
}

// Helper for protecting admin routes
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading authentication...</div>
      </div>
    );
  }
  
  return user && user.role === 'admin' ? children : <Navigate to="/" />;
}

function MainLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/podcast/:id" element={<PodcastDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route 
            path="/home" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/playlists" 
            element={
              <ProtectedRoute>
                <Playlists />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/playlists/:id" 
            element={
              <ProtectedRoute>
                <PlaylistDetails />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/downloads" 
            element={
              <ProtectedRoute>
                <Downloads />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/creator" 
            element={
              <CreatorRoute>
                <CreatorDashboard />
              </CreatorRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } 
          />
          <Route 
            path="/library" 
            element={
              <ProtectedRoute>
                <ListenHistory />
              </ProtectedRoute>
            } 
          />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <AudioPlayer />
    </>
  );
}

export default function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Router>
        <AuthProvider>
          <ThemeProvider>
            <PlayerProvider>
              <MainLayout />
            </PlayerProvider>
          </ThemeProvider>
        </AuthProvider>
      </Router>
    </GoogleOAuthProvider>
  );
}
