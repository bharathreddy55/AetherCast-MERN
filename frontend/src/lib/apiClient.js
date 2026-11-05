import { supabase } from '../supabase';
import { API_BASE_URL } from './config';
import { createApiClient } from './createApiClient';
import { credentialGate } from './credentialSession';

export const apiFetch = createApiClient({
  apiBaseUrl: API_BASE_URL,
  getAccessToken: () => credentialGate.accessToken(supabase.auth),
});
