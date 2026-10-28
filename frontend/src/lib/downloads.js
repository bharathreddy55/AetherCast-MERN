import { apiFetch } from './apiClient';
import { API_BASE_URL } from './config';
import { createDownloadStore } from './createDownloadStore';

const store = () => createDownloadStore({ cacheStorage: globalThis.caches, storage: localStorage, origin: location.origin });
const pendingDownloads = new Set();
export const listDownloads = owner => {
  try { return store().list(owner); } catch { return []; }
};
export const readDownload = (owner, id) => store().read(owner, id);
export const removeDownload = (owner, id) => store().remove(owner, id);
export const clearDownloads = async owner => {
  const pending = [...pendingDownloads].filter(job => job.owner === owner);
  pending.forEach(job => job.controller.abort());
  // Wait for any in-progress cache writes before erasing the account cache.
  await Promise.allSettled(pending.map(job => job.task));
  await store().clear(owner);
};

export async function downloadEpisode(owner, episode) {
  if (!owner) throw new Error('Sign in before downloading media.');
  const controller = new AbortController();
  const job = { owner, controller };
  job.task = (async () => {
    const details = await apiFetch(`${API_BASE_URL}/episodes/${episode._id}`, { signal: controller.signal });
    const data = await details.json();
    if (!details.ok || !data.success || !data.isAuthorized || !data.episode?.audioUrl) {
      throw new Error(data.message || 'Unable to authorize this download.');
    }
    const response = await fetch(window.getMediaUrl(data.episode.audioUrl), { cache: 'no-store', redirect: 'error', signal: controller.signal });
    controller.signal.throwIfAborted();
    await store().save(owner, data.episode, response);
    window.dispatchEvent(new Event('library-downloads-changed'));
  })();
  pendingDownloads.add(job);
  try { await job.task; }
  finally { pendingDownloads.delete(job); }
}
