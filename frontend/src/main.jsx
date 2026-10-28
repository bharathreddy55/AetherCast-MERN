import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BACKEND_URL } from './lib/config'

window.BACKEND_URL = BACKEND_URL;
window.getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('/artwork/')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const cleanBackend = window.BACKEND_URL.endsWith('/') ? window.BACKEND_URL.slice(0, -1) : window.BACKEND_URL;
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBackend}${cleanUrl}`;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('Service Worker registered successfully!', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}
