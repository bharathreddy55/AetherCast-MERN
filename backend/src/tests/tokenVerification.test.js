const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createSupabaseVerifier } = require('../utils/supabaseTokens');

const pair = () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return { privateKey, jwk: publicKey.export({ format: 'jwk' }) };
};
const first = pair();
const rotated = pair();
const origin = 'https://verification.supabase.co';
const sign = (key, kid, options = {}) => jwt.sign({ sub: 'owner', email: 'owner@example.com' }, key, {
  algorithm: 'ES256', keyid: kid, issuer: `${origin}/auth/v1`, audience: 'authenticated', expiresIn: '5m', ...options,
});
const keys = (...entries) => Response.json({ keys: entries.map(([pair, kid]) => ({ ...pair.jwk, kid, alg: 'ES256', use: 'sig' })) });

test('refreshes a cached key set when Supabase rotates to a new signing key', async () => {
  const fetchImpl = jest.fn().mockResolvedValueOnce(keys([first, 'first'])).mockResolvedValueOnce(keys([rotated, 'rotated']));
  const verify = createSupabaseVerifier({ fetchImpl, env: { SUPABASE_URL: origin } });
  expect((await verify(sign(first.privateKey, 'first'))).sub).toBe('owner');
  expect((await verify(sign(rotated.privateKey, 'rotated'))).sub).toBe('owner');
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test('reuses cached keys for ordinary requests and refreshes expired caches', async () => {
  let time = 0;
  const fetchImpl = jest.fn().mockImplementation(async () => keys([first, 'first']));
  const verify = createSupabaseVerifier({ fetchImpl, now: () => time, env: { SUPABASE_URL: origin } });
  const token = sign(first.privateKey, 'first');
  await verify(token);
  await verify(token);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  time = 600001;
  await verify(token);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test('coalesces concurrent key fetches', async () => {
  let release;
  const fetchImpl = jest.fn().mockImplementation(() => new Promise(resolve => { release = resolve; }));
  const verify = createSupabaseVerifier({ fetchImpl, env: { SUPABASE_URL: origin } });
  const token = sign(first.privateKey, 'first');
  const requests = [verify(token), verify(token), verify(token)];
  release(keys([first, 'first']));
  await Promise.all(requests);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('bounds repeated unknown-key refreshes and retries after the cooldown', async () => {
  let time = 0;
  const fetchImpl = jest.fn().mockImplementation(async () => keys([first, 'first']));
  const verify = createSupabaseVerifier({ fetchImpl, now: () => time, env: { SUPABASE_URL: origin } });
  await verify(sign(first.privateKey, 'first'));
  for (let index = 0; index < 5; index++) await expect(verify(sign(rotated.privateKey, 'missing'))).rejects.toThrow();
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  time = 30001;
  await expect(verify(sign(rotated.privateKey, 'missing'))).rejects.toThrow();
  expect(fetchImpl).toHaveBeenCalledTimes(3);
});

test('fails closed on key endpoint failures or invalid key responses', async () => {
  for (const response of [new Response(null, { status: 503 }), Response.json({ unexpected: true }), Response.json({ keys: [] })]) {
    const verify = createSupabaseVerifier({ fetchImpl: jest.fn().mockResolvedValue(response), env: { SUPABASE_URL: origin } });
    await expect(verify(sign(first.privateKey, 'first'))).rejects.toThrow();
  }
});

test('does not use expired cached keys if a refresh fails', async () => {
  let time = 0;
  const fetchImpl = jest.fn().mockResolvedValueOnce(keys([first, 'first'])).mockRejectedValueOnce(new Error('Unavailable'));
  const verify = createSupabaseVerifier({ fetchImpl, now: () => time, env: { SUPABASE_URL: origin } });
  const token = sign(first.privateKey, 'first');
  await verify(token);
  time = 600001;
  await expect(verify(token)).rejects.toThrow('Unavailable');
});

test('does not share cached keys across configured Supabase projects', async () => {
  const env = { SUPABASE_URL: origin };
  const fetchImpl = jest.fn().mockImplementation(async () => keys([first, 'first']));
  const verify = createSupabaseVerifier({ fetchImpl, env });
  await verify(sign(first.privateKey, 'first'));
  env.SUPABASE_URL = 'https://another.supabase.co';
  await verify(sign(first.privateKey, 'first', { issuer: `${env.SUPABASE_URL}/auth/v1` }));
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(fetchImpl.mock.calls[1][0]).toBe('https://another.supabase.co/auth/v1/.well-known/jwks.json');
});

test('rejects forged signatures and non-signing keys', async () => {
  for (const jwk of [{ ...first.jwk, kid: 'first', use: 'enc' }, { ...first.jwk, kid: 'first', alg: 'HS256' }]) {
    const verify = createSupabaseVerifier({ fetchImpl: async () => Response.json({ keys: [jwk] }), env: { SUPABASE_URL: origin } });
    await expect(verify(sign(first.privateKey, 'first'))).rejects.toThrow();
  }
  const verify = createSupabaseVerifier({ fetchImpl: async () => keys([first, 'first']), env: { SUPABASE_URL: origin } });
  await expect(verify(sign(rotated.privateKey, 'first'))).rejects.toThrow();
});

test('requires expiry and rejects expired, wrong-audience and wrong-issuer tokens', async () => {
  const verify = createSupabaseVerifier({ fetchImpl: async () => keys([first, 'first']), env: { SUPABASE_URL: origin } });
  for (const options of [{ expiresIn: undefined }, { expiresIn: '-1s' }, { audience: 'another' }, { issuer: 'https://another.supabase.co/auth/v1' }]) {
    const base = { ...options };
    // jsonwebtoken rejects an explicitly undefined expiresIn option itself.
    const token = options.expiresIn === undefined && Object.hasOwn(options, 'expiresIn')
      ? jwt.sign({ sub: 'owner' }, first.privateKey, { algorithm: 'ES256', keyid: 'first', issuer: `${origin}/auth/v1`, audience: 'authenticated' })
      : sign(first.privateKey, 'first', base);
    await expect(verify(token)).rejects.toThrow();
  }
});

test('legacy signing uses the exact configured string and never a placeholder fallback', async () => {
  const secret = 'a-long-test-only-legacy-secret-that-must-not-be-base64-decoded';
  const token = jwt.sign({ sub: 'owner' }, secret, { algorithm: 'HS256', issuer: `${origin}/auth/v1`, audience: 'authenticated', expiresIn: '5m' });
  const verify = createSupabaseVerifier({ env: { SUPABASE_URL: origin, SUPABASE_JWT_SECRET: secret } });
  expect((await verify(token)).sub).toBe('owner');
  for (const value of [undefined, 'your-supabase-jwt-secret-here']) {
    const unconfigured = createSupabaseVerifier({ env: { SUPABASE_URL: origin, SUPABASE_JWT_SECRET: value } });
    await expect(unconfigured(token)).rejects.toThrow('not configured');
  }
});
