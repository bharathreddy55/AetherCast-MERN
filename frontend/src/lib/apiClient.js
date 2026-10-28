import { supabase } from '../supabase';
import { API_BASE_URL } from './config';
import { createApiClient } from './createApiClient';

export const apiFetch = createApiClient({
  apiBaseUrl: API_BASE_URL,
  getAccessToken: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.access_token;
  },
});
