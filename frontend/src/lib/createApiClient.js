// Only attach the owner's bearer token to this application's API.
export function createApiClient({ apiBaseUrl, getAccessToken, fetchImpl = globalThis.fetch }) {
  const base = new URL(apiBaseUrl);
  return async (input, options = {}) => {
    const url = new URL(input, `${base.href}/`);
    if (url.origin !== base.origin || !(url.pathname === base.pathname || url.pathname.startsWith(`${base.pathname}/`))) {
      throw new Error('Authenticated requests must target the library API.');
    }
    const token = await getAccessToken();
    if (!token) throw new Error('Please sign in to access your private library.');
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetchImpl(url.href, { ...options, headers, cache: 'no-store', redirect: 'error' });
  };
}
