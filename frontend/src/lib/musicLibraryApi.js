import { apiFetch } from './apiClient';
import { API_BASE_URL } from './config';
import { createMusicLibraryClient } from './musicLibraryClient';
export const musicLibraryRequest = createMusicLibraryClient({ apiBaseUrl: API_BASE_URL, apiFetch });
export const notifyMusicLibrary = () => window.dispatchEvent(new Event('music-library-changed'));
