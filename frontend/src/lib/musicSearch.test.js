import test from 'node:test';
import assert from 'node:assert/strict';
import { musicSearchState, musicSearchParams, musicSearchHref, createMusicSearchLoader } from './musicSearch.js';
test('search URL round trips Unicode, literal punctuation and browser navigation state', () => {
  const state = { q: 'తెలుగు & A.*[x]', group: 'albums', page: 3, sort: 'recent' };
  assert.deepEqual(musicSearchState(new URLSearchParams(musicSearchParams(state))), state);
  const link = new URL(musicSearchHref(state, { group: 'tracks' }), 'https://app.test');
  assert.equal(link.pathname, '/music/search'); assert.equal(link.searchParams.get('page'), '1');
  assert.equal(link.searchParams.get('q'), state.q);
});
test('category changes reset paging while invalid navigation state is bounded', () => {
  assert.deepEqual(musicSearchState(new URLSearchParams('group=unknown&page=999999&sort=random')), { q: '', group: 'all', page: 1, sort: 'title' });
  assert.equal(musicSearchState(new URLSearchParams('group=tracks&page=999999')).page, 1000);
  assert.equal(musicSearchState(new URLSearchParams('group=tracks&page=-1')).page, 1);
  assert.equal(new URLSearchParams(musicSearchParams({ q: ' x ', group: 'all', page: 1, sort: 'title' })).get('limit'), '6');
});
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const response = value => ({ ok: true, json: async () => ({ success: true, ...value }) });
test('newer results win even when the old request ignores its abort signal', async () => {
  const old = deferred(), fresh = deferred(), results = [], errors = [], signals = [];
  const loader = createMusicSearchLoader({ request: (key, { signal }) => { signals.push(signal); return key === 'old' ? old.promise : fresh.promise; },
    onResult: (data, key) => results.push([data, key]), onError: error => errors.push(error) });
  const a = loader.load('old'), b = loader.load('fresh');
  assert.equal(signals[0].aborted, true);
  fresh.resolve(response({ q: 'fresh' })); await b;
  old.resolve(response({ q: 'old' })); await a;
  assert.deepEqual(results, [[{ success: true, q: 'fresh' }, 'fresh']]); assert.deepEqual(errors, []);
});
test('navigation/logout cleanup suppresses late success and late parse errors', async () => {
  for (const value of [response({}), { ok: true, json: async () => { throw new Error('late'); } }]) {
    const work = deferred(), published = [];
    const loader = createMusicSearchLoader({ request: () => work.promise, onResult: data => published.push(data), onError: error => published.push(error) });
    const pending = loader.load('old'); loader.cancel(); work.resolve(value); await pending; assert.deepEqual(published, []);
  }
});
test('denied/failed search shows an error and never publishes success or retries automatically', async () => {
  const results = [], errors = []; let calls = 0;
  const loader = createMusicSearchLoader({ request: async () => { ++calls; return { ok: false, json: async () => ({ success: false, message: 'Sign in again' }) }; },
    onResult: data => results.push(data), onError: message => errors.push(message) });
  await loader.load('query'); assert.equal(calls, 1); assert.deepEqual(results, []); assert.deepEqual(errors, ['Sign in again']);
});
