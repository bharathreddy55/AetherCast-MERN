import { apiFetch } from './apiClient';
import { API_BASE_URL } from './config';
export async function musicProcessingRequest(path, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}/music/${path}`, options);
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load media processing status.');
  return data;
}
