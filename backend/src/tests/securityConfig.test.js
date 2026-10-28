const request = require('supertest');
const app = require('../app');
const { allowedOrigins, isOriginAllowed, validateProduction } = require('../config/security');

const production = () => ({
  NODE_ENV: 'production', MONGO_URI: 'mongodb://example.test/library', SUPABASE_URL: 'https://example.supabase.co',
  OWNER_SUPABASE_USER_ID: '22ee4604-30c6-4efa-9bc6-b522de3770e9',
  SUPABASE_SERVICE_ROLE_KEY: 'test-server-credential-'.repeat(3), MEDIA_SIGNING_SECRET: 'test-media-secret-'.repeat(3),
  CLIENT_URL: 'https://aether-cast-mern.vercel.app',
});

test('production permits only explicitly configured origins', () => {
  const env = production();
  expect(isOriginAllowed(env.CLIENT_URL, env)).toBe(true);
  for (const origin of ['https://attacker.vercel.app', 'https://aether-cast-mern.vercel.app.attacker.test',
    'http://localhost:5173', 'http://localhost:9999', 'null', 'https://aether-cast-mern.vercel.app/path']) {
    expect(isOriginAllowed(origin, env)).toBe(false);
  }
  expect(isOriginAllowed(undefined, env)).toBe(true);
});

test('additional preview/custom origins must be listed individually', () => {
  const env = { ...production(), ADDITIONAL_CLIENT_ORIGINS: 'https://preview.example/, https://custom.example' };
  expect(isOriginAllowed('https://preview.example', env)).toBe(true);
  expect(isOriginAllowed('https://custom.example', env)).toBe(true);
  expect(isOriginAllowed('https://another-preview.example', env)).toBe(false);
});

test('development has two explicit local origins, not arbitrary localhost ports', () => {
  expect(isOriginAllowed('http://localhost:5173', { NODE_ENV: 'development' })).toBe(true);
  expect(isOriginAllowed('http://127.0.0.1:5173', { NODE_ENV: 'development' })).toBe(true);
  expect(isOriginAllowed('http://localhost:9999', { NODE_ENV: 'development' })).toBe(false);
});

test('production ES256 authentication does not require a legacy shared JWT secret or backend anon key', () => {
  expect(() => validateProduction(production())).not.toThrow();
});

test.each(['MONGO_URI', 'SUPABASE_URL', 'OWNER_SUPABASE_USER_ID', 'SUPABASE_SERVICE_ROLE_KEY', 'MEDIA_SIGNING_SECRET', 'CLIENT_URL'])(
  'production rejects missing %s before serving requests', key => {
    const env = production();
    delete env[key];
    expect(() => validateProduction(env)).toThrow(key);
  },
);

test('rejects placeholder secrets, wrong owner IDs and unsafe URLs without printing values', () => {
  for (const overrides of [
    { SUPABASE_SERVICE_ROLE_KEY: 'your-service-key' }, { SUPABASE_JWT_SECRET: 'your-supabase-jwt-secret-here' },
    { OWNER_SUPABASE_USER_ID: 'qapyqxqdswrocuoutdfs' }, { MEDIA_SIGNING_SECRET: 'short' },
    { SUPABASE_URL: 'http://example.supabase.co' }, { CLIENT_URL: 'https://example.test/another-path' },
    { CLIENT_URL: 'https://user:password@example.test' }, { ADDITIONAL_CLIENT_ORIGINS: 'https://*.vercel.app' },
  ]) {
    expect(() => validateProduction({ ...production(), ...overrides })).toThrow();
  }
  expect(() => allowedOrigins({ CLIENT_URL: 'https://example.test?token=secret' })).toThrow();
});

test('HTTP preflight uses the same origin policy and preserves authentication requirements', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  const allowed = await request(app).options('/api/episodes').set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'GET');
  expect(allowed.status).toBe(204);
  expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  const denied = await request(app).get('/api/episodes').set('Origin', 'https://attacker.vercel.app');
  expect(denied.status).toBe(403);
  expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  const unauthenticated = await request(app).get('/api/episodes').set('Origin', 'http://localhost:5173');
  expect(unauthenticated.status).toBe(401);
  errorLog.mockRestore();
});
