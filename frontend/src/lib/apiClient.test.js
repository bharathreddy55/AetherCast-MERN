import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from './createApiClient.js';
import { resolveBackendUrl } from './config.js';

const apiBaseUrl = 'https://library.example/api';

test('adds the current session token to requests that previously allowed guests', async () => {
  let currentToken = 'first';
  const calls = [];
  const client = createApiClient({ apiBaseUrl, getAccessToken: async () => currentToken,
    fetchImpl: async (...args) => { calls.push(args); return 'response'; } });
  assert.equal(await client(`${apiBaseUrl}/podcasts`), 'response');
  currentToken = 'refreshed';
  await client(`${apiBaseUrl}/episodes`, { headers: { Authorization: 'Bearer stale' } });
  assert.equal(calls[0][1].headers.get('Authorization'), 'Bearer first');
  assert.equal(calls[1][1].headers.get('Authorization'), 'Bearer refreshed');
  assert.equal(calls[1][1].cache, 'no-store');
  assert.equal(calls[1][1].redirect, 'error');
});

test('preserves multipart bodies, custom headers, method and cancellation', async () => {
  const body = new FormData();
  body.append('title', 'An album');
  const { signal } = new AbortController();
  const client = createApiClient({ apiBaseUrl, getAccessToken: async () => 'owner',
    fetchImpl: async (_url, options) => {
      assert.equal(options.body, body);
      assert.equal(options.signal, signal);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.get('Content-Type'), null);
      assert.equal(options.headers.get('X-Test'), 'preserved');
    } });
  await client(`${apiBaseUrl}/podcasts`, { method: 'POST', body, signal, headers: { 'X-Test': 'preserved' } });
});

test('never sends an owner token to an external URL or a non-API path', async () => {
  let requestedToken = false;
  const client = createApiClient({ apiBaseUrl, getAccessToken: async () => { requestedToken = true; return 'owner'; },
    fetchImpl: async () => assert.fail('Unexpected network request') });
  for (const url of ['https://other.example/api/podcasts', 'https://library.example/uploads/song.mp3', 'https://library.example/api-other']) {
    await assert.rejects(client(url), /must target the library API/);
  }
  assert.equal(requestedToken, false);
});

test('requires a session and propagates session failures without making a request', async () => {
  const fetchImpl = async () => assert.fail('Unexpected network request');
  const signedOut = createApiClient({ apiBaseUrl, getAccessToken: async () => null, fetchImpl });
  await assert.rejects(signedOut(`${apiBaseUrl}/podcasts`), /Please sign in/);
  const failed = createApiClient({ apiBaseUrl, getAccessToken: async () => { throw new Error('Session unavailable'); }, fetchImpl });
  await assert.rejects(failed(`${apiBaseUrl}/podcasts`), /Session unavailable/);
});

test('uses one normalized backend URL for API and media configuration', () => {
  assert.equal(resolveBackendUrl(' https://library.example/// '), 'https://library.example');
  assert.equal(resolveBackendUrl(undefined, 'localhost'), 'http://localhost:5000');
  assert.equal(resolveBackendUrl(undefined, 'personal.example'), 'https://podcast-backend-3lt7.onrender.com');
  for (const value of ['file:///private', 'https://user:password@library.example', 'https://library.example?secret=x']) {
    assert.throws(() => resolveBackendUrl(value), /backend URL/);
  }
});
