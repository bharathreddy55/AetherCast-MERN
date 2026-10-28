const isPlaceholder = value => /your[-_]|change[-_]me|placeholder/i.test(value || '');

function supabaseOrigin(env = process.env) {
  if (!env.SUPABASE_URL || isPlaceholder(env.SUPABASE_URL)) throw new Error('SUPABASE_URL must be configured');
  const url = new URL(env.SUPABASE_URL);
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname.includes('*') || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new Error('SUPABASE_URL must be a valid project origin');
  return url.origin;
}

function allowedOrigins(env = process.env) {
  const configured = [env.CLIENT_URL, ...(env.ADDITIONAL_CLIENT_ORIGINS || '').split(',')].filter(value => value?.trim());
  if (env.NODE_ENV !== 'production') configured.push('http://localhost:5173', 'http://127.0.0.1:5173');
  return new Set(configured.map(value => {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.hostname.includes('*') || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        (env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new Error('Client origins must be explicit HTTP(S) origins without paths or credentials');
    return url.origin;
  }));
}

function isOriginAllowed(origin, env = process.env) {
  if (origin === undefined) return true; // Non-browser clients still require authentication.
  try { return typeof origin === 'string' && new URL(origin).origin === origin && allowedOrigins(env).has(origin); }
  catch { return false; }
}

function corsOrigin(origin, callback) {
  if (isOriginAllowed(origin)) return callback(null, true);
  const error = new Error('Website origin is not allowed');
  error.status = 403;
  callback(error);
}

function validateProduction(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const required = ['MONGO_URI', 'SUPABASE_URL', 'OWNER_SUPABASE_USER_ID', 'SUPABASE_SERVICE_ROLE_KEY', 'MEDIA_SIGNING_SECRET', 'CLIENT_URL'];
  const missing = required.filter(key => !env[key]?.trim() || isPlaceholder(env[key]));
  if (missing.length) throw new Error(`Missing or placeholder production configuration: ${missing.join(', ')}`);
  supabaseOrigin(env);
  allowedOrigins(env);
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGO_URI)) throw new Error('MONGO_URI must be a MongoDB connection string');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(env.OWNER_SUPABASE_USER_ID)) throw new Error('OWNER_SUPABASE_USER_ID must be the owner User UID');
  if (env.MEDIA_SIGNING_SECRET.length < 32 || env.SUPABASE_SERVICE_ROLE_KEY.length < 32) throw new Error('Production storage and media secrets must be at least 32 characters');
  if (env.SUPABASE_JWT_SECRET && (isPlaceholder(env.SUPABASE_JWT_SECRET) || env.SUPABASE_JWT_SECRET.length < 32)) {
    throw new Error('SUPABASE_JWT_SECRET must be the real legacy signing secret, or unset for ES256-only authentication');
  }
}

module.exports = { isPlaceholder, supabaseOrigin, allowedOrigins, isOriginAllowed, corsOrigin, validateProduction };
