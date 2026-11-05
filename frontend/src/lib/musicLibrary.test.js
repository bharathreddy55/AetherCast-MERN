import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicLibraryClient, playablePlaylist } from './musicLibraryClient.js';
import { musicEntries, selectMusicOccurrence } from './musicQueue.js';

test('music library writes use authenticated client requests and explicit versions', async () => {
  const calls = [];
  const request = createMusicLibraryClient({ apiBaseUrl: 'https://library.example/api', apiFetch: async (...args) => { calls.push(args); return { ok: true, json: async () => ({ success: true }) }; } });
  await request('/playlists/abc', { method: 'PATCH', body: { version: 7, operation: 'add', trackIds: ['song'] } });
  assert.equal(calls[0][0], 'https://library.example/api/music/library/playlists/abc');
  assert.equal(calls[0][1].method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0][1].body), { version: 7, operation: 'add', trackIds: ['song'] });
});
test('library client rejects external/traversal paths without issuing requests', async () => {
  const request = createMusicLibraryClient({ apiBaseUrl: 'https://library.example/api', apiFetch: async () => assert.fail('Unexpected request') });
  for (const path of ['https://other.example/', '//other.example', '/../auth', '/playlists#fragment']) await assert.rejects(request(path), /Invalid/);
});
test('playlist conflicts and invalid responses never report success or retry additions', async () => {
  let count = 0;
  const request = createMusicLibraryClient({ apiBaseUrl: 'https://library.example/api', apiFetch: async () => { count++; return { ok: false, status: 409, json: async () => ({ message: 'Refresh before editing' }) }; } });
  await assert.rejects(request('/playlists/abc', { method: 'PATCH', body: { version: 1 } }), error => error.status === 409);
  assert.equal(count, 1);
  const malformed = createMusicLibraryClient({ apiBaseUrl: 'https://library.example/api', apiFetch: async () => ({ ok: true, json: async () => { throw new Error('HTML'); } }) });
  await assert.rejects(malformed('/playlists'), /Unable to read/);
});
test('playlist playback targets the selected occurrence even when the song is repeated', () => {
  const track = { _id: 'song', title: 'Repeated' };
  const items = [{ _id: 'first', track }, { _id: 'missing', track: null, unavailable: true }, { _id: 'second', track }];
  const context = playablePlaylist(items, 'second');
  assert.equal(context.startIndex, 1);
  assert.equal(context.skipped, 1);
  const entries = musicEntries(context.tracks);
  assert.equal(selectMusicOccurrence(entries, track, context.startIndex).queueItemId, entries[1].queueItemId);
  assert.notEqual(entries[0].queueItemId, entries[1].queueItemId);
});
test('unavailable playlist occurrences cannot accidentally select a different copy', () => {
  const items = [{ _id: 'missing', track: null, unavailable: true }, { _id: 'available', track: { _id: 'song' } }];
  assert.throws(() => playablePlaylist(items, 'missing'), /unavailable/);
  const entries = musicEntries([{ _id: 'song' }]);
  assert.equal(selectMusicOccurrence(entries, { _id: 'other' }, 0), null);
  assert.equal(selectMusicOccurrence(entries, { _id: 'song' }, -1), null);
  assert.equal(selectMusicOccurrence(entries, { _id: 'song' }, 2), null);
});
