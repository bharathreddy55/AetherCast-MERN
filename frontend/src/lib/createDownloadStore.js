export const DOWNLOAD_CACHE_PREFIX = 'aether-audio-v2-';

export function createDownloadStore({ cacheStorage, storage, origin }) {
  const validateId = value => {
    if (!/^[a-zA-Z0-9_-]+$/.test(value || '')) throw new Error('A valid owner and media ID are required.');
    return value;
  };
  const indexKey = owner => `aether-downloads-v2:${validateId(owner)}`;
  const cacheName = owner => `${DOWNLOAD_CACHE_PREFIX}${validateId(owner)}`;
  const mediaKey = (owner, id) => `${origin}/__offline_media/${validateId(owner)}/${validateId(id)}`;
  const list = owner => {
    if (!owner) return [];
    try {
      const result = JSON.parse(storage.getItem(indexKey(owner)) || '[]');
      return Array.isArray(result) ? result : [];
    } catch { return []; }
  };
  const read = async (owner, id) => {
    if (!owner || !list(owner).some(item => item._id === id)) return null;
    const cache = await cacheStorage.open(cacheName(owner));
    const response = await cache.match(mediaKey(owner, id));
    return response?.status === 200 ? response : null;
  };
  return {
    list, read,
    async save(owner, episode, response) {
      if (response.status !== 200) throw new Error('A complete media file is required for offline listening.');
      const cache = await cacheStorage.open(cacheName(owner));
      const key = mediaKey(owner, episode._id);
      const previous = await cache.match(key);
      await cache.put(key, response);
      try {
        const entries = list(owner).filter(item => item._id !== episode._id);
        // Never persist expiring playback capabilities as offline identities.
        entries.push({ ...episode, audioUrl: '' });
        storage.setItem(indexKey(owner), JSON.stringify(entries));
      } catch (error) {
        if (previous) await cache.put(key, previous);
        else await cache.delete(key);
        throw error;
      }
    },
    async remove(owner, id) {
      const cache = await cacheStorage.open(cacheName(owner));
      await cache.delete(mediaKey(owner, id));
      storage.setItem(indexKey(owner), JSON.stringify(list(owner).filter(item => item._id !== id)));
    },
    async clear(owner) {
      if (!owner) return;
      await cacheStorage.delete(cacheName(owner));
      storage.removeItem(indexKey(owner));
    },
  };
}
