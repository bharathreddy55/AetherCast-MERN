import test from 'node:test';
import assert from 'node:assert/strict';
import { createDownloadStore } from './createDownloadStore.js';

function fixture() {
  const indexes = new Map();
  const caches = new Map();
  const storage = {
    getItem: key => indexes.get(key) || null,
    setItem: (key, value) => indexes.set(key, value),
    removeItem: key => indexes.delete(key),
  };
  const cacheStorage = {
    open: async name => {
      if (!caches.has(name)) caches.set(name, new Map());
      const entries = caches.get(name);
      return {
        match: async key => entries.get(key)?.clone(),
        put: async (key, response) => { entries.set(key, response.clone()); },
        delete: async key => entries.delete(key),
      };
    },
    delete: async name => caches.delete(name),
  };
  return { storage, cacheStorage, caches, store: createDownloadStore({ cacheStorage, storage, origin: 'https://library.example' }) };
}

test('download identity survives changing signed URLs and is isolated by account', async () => {
  const { store } = fixture();
  await store.save('owner-one', { _id: 'track-one', title: 'A song', audioUrl: '/media/old-token' }, new Response('song'));
  assert.equal(await (await store.read('owner-one', 'track-one')).text(), 'song');
  assert.equal(await store.read('owner-two', 'track-one'), null);
  assert.equal(store.list('owner-one')[0].audioUrl, '');
});

test('refuses partial/error downloads and does not create a successful index entry', async () => {
  const { store } = fixture();
  for (const status of [206, 401, 404, 500]) {
    await assert.rejects(store.save('owner', { _id: 'track' }, new Response('bad', { status })), /complete media file/);
  }
  assert.deepEqual(store.list('owner'), []);
});

test('detects an evicted download instead of trusting its metadata entry', async () => {
  const { store, caches } = fixture();
  await store.save('owner', { _id: 'track' }, new Response('song'));
  caches.clear();
  assert.equal(await store.read('owner', 'track'), null);
});

test('rolls back cached audio if storing the metadata fails', async () => {
  const { store, storage } = fixture();
  storage.setItem = () => { throw new Error('Storage quota exceeded'); };
  await assert.rejects(store.save('owner', { _id: 'track' }, new Response('song')), /quota/);
  assert.equal(await store.read('owner', 'track'), null);
});

test('removes one download and clears only the specified owner on logout', async () => {
  const { store } = fixture();
  await store.save('owner', { _id: 'track' }, new Response('song'));
  await store.save('other-owner', { _id: 'track' }, new Response('other song'));
  await store.remove('owner', 'track');
  assert.deepEqual(store.list('owner'), []);
  await store.save('owner', { _id: 'track' }, new Response('song'));
  await store.clear('owner');
  assert.deepEqual(store.list('owner'), []);
  assert.equal(await (await store.read('other-owner', 'track')).text(), 'other song');
});
