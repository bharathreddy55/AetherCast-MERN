import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
function worker() {
  const handlers = new Map();
  const deleted = [];
  vm.runInNewContext(source, {
    self: { location: { origin: 'https://library.example' },
      addEventListener: (event, handler) => handlers.set(event, handler),
      skipWaiting() {}, clients: { claim() {} } },
    caches: { keys: async () => ['vox-static-v1', 'vox-audio-v1', 'aether-static-v2', 'aether-audio-v2-owner', 'unrelated-app'],
      delete: async name => deleted.push(name) },
    URL, Response,
  });
  return { handlers, deleted };
}

test('service worker never replays signed media, private API, or cross-origin storage from a shared cache', () => {
  const { handlers } = worker();
  for (const url of [
    'https://library.example/media/expired-token', 'https://library.example/api/episodes',
    'https://library.example/uploads/song.mp3', 'https://library.example/__offline_media/owner/track',
    'https://storage.example/storage/v1/object/public/vox/song.mp3',
  ]) {
    handlers.get('fetch')({ request: { url, method: 'GET' }, respondWith: () => assert.fail('Private request intercepted') });
  }
});

test('service worker upgrade removes legacy shared caches and preserves account downloads', async () => {
  const { handlers, deleted } = worker();
  let task;
  handlers.get('activate')({ waitUntil: promise => { task = promise; } });
  await task;
  assert.deepEqual(deleted.sort(), ['vox-audio-v1', 'vox-static-v1']);
});
