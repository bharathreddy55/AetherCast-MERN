const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { supabaseOrigin, isPlaceholder } = require('../config/security');

function createSupabaseVerifier({ fetchImpl = (...args) => fetch(...args), now = Date.now, env = process.env } = {}) {
  const projects = new Map();
  const ttl = 10 * 60 * 1000;
  const refreshCooldown = 30000;
  return async token => {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !['ES256', 'HS256'].includes(decoded.header.alg)) throw new Error('Unsupported or invalid token');
    const origin = supabaseOrigin(env);
    let key;
    if (decoded.header.alg === 'ES256') {
      const kid = decoded.header.kid;
      if (typeof kid !== 'string' || !kid || kid.length > 200) throw new Error('Missing or invalid signing key ID');
      if (!projects.has(origin)) projects.set(origin, { keys: null, expires: 0, inflight: null, forcedAt: -Infinity });
      const state = projects.get(origin);
      const readKeys = async force => {
        if (state.inflight) return state.inflight;
        if (!force && state.keys && now() < state.expires) return state.keys;
        if (force && now() - state.forcedAt < refreshCooldown) return state.keys || [];
        if (force) state.forcedAt = now();
        state.inflight = (async () => {
          const response = await fetchImpl(`${origin}/auth/v1/.well-known/jwks.json`, {
            signal: AbortSignal.timeout(10000), redirect: 'error',
          });
          if (!response.ok) throw new Error('Unable to load authentication signing keys');
          const data = await response.json();
          if (!Array.isArray(data.keys)) throw new Error('Invalid authentication signing keys');
          state.keys = data.keys;
          state.expires = now() + ttl;
          return state.keys;
        })();
        try { return await state.inflight; }
        finally { state.inflight = null; }
      };
      const hadFreshCache = state.keys && now() < state.expires;
      let keys = await readKeys(false);
      let jwk = keys.find(candidate => candidate.kid === kid);
      if (!jwk && hadFreshCache) {
        keys = await readKeys(true);
        jwk = keys.find(candidate => candidate.kid === kid);
      }
      if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || (jwk.alg && jwk.alg !== 'ES256') || (jwk.use && jwk.use !== 'sig')) {
        throw new Error('Unknown or incompatible signing key');
      }
      key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    } else {
      // Supabase's legacy secret is the exact configured string. Its length
      // does not determine whether it should be decoded as base64.
      key = env.SUPABASE_JWT_SECRET;
      if (!key || isPlaceholder(key)) throw new Error('Legacy signing is not configured');
    }
    const payload = jwt.verify(token, key, {
      algorithms: [decoded.header.alg], issuer: `${origin}/auth/v1`, audience: 'authenticated',
    });
    if (!Number.isFinite(payload.exp)) throw new Error('Token expiry is required');
    return payload;
  };
}

// Resolve process.env lazily so tests/configuration cannot inherit another
// project's keys or legacy secret through a captured environment object.
const verifySupabaseToken = createSupabaseVerifier({ env: new Proxy({}, { get: (_target, key) => process.env[key] }) });
module.exports = { createSupabaseVerifier, verifySupabaseToken };
