export function createMusicLibraryClient({ apiBaseUrl, apiFetch }) {
  return async (path, { method = 'GET', body, signal, ...options } = {}) => {
    if (!/^\/[a-zA-Z0-9/?=&,%._-]*$/.test(path) || path.includes('..') || path.startsWith('//')) throw new Error('Invalid music library request.');
    const response = await apiFetch(`${apiBaseUrl}/music/library${path}`, { ...options, method, signal,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    let data;
    try { data = await response.json(); } catch { throw new Error('Unable to read the music library response.'); }
    if (!response.ok || !data.success) {
      const error = new Error(response.status === 409 ? data.message || 'This playlist changed. Refresh before editing.' : data.message || 'Unable to update your library.');
      error.status = response.status;
      throw error;
    }
    return data;
  };
}
export const libraryPaths = { tracks: '/likes', albums: '/saved/albums', artists: '/followed/artists' };
export const libraryStateFields = { tracks: 'trackIds', albums: 'albumIds', artists: 'artistIds' };
export function playablePlaylist(items, itemId) {
  const available = items.filter(item => item.track && !item.unavailable);
  const startIndex = itemId ? available.findIndex(item => item._id === itemId) : 0;
  if (!available.length || startIndex < 0) throw new Error('This playlist song is unavailable.');
  return { tracks: available.map(item => item.track), startIndex, skipped: items.length - available.length };
}
