import { createClient } from '@supabase/supabase-js';
import { credentialAuthOptions, clearLegacyLogin } from './lib/credentialSession';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

for (const name of ['localStorage', 'sessionStorage']) {
  try { clearLegacyLogin(globalThis[name], supabaseUrl); } catch { /* Storage may be disabled. */ }
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: credentialAuthOptions });
