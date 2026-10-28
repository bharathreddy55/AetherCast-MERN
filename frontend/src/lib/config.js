export function resolveBackendUrl(configuredUrl, hostname = 'localhost') {
  const fallback = ['localhost', '127.0.0.1', '::1'].includes(hostname)
    ? 'http://localhost:5000'
    : 'https://podcast-backend-3lt7.onrender.com';
  const url = new URL(configuredUrl?.trim() || fallback);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('The backend URL must be an HTTP(S) URL without credentials, a query, or a fragment.');
  }
  return url.href.replace(/\/+$/, '');
}

export const BACKEND_URL = resolveBackendUrl(import.meta.env?.VITE_API_URL, globalThis.location?.hostname);
export const API_BASE_URL = `${BACKEND_URL}/api`;
