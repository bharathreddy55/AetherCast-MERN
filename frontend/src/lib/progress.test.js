import test from 'node:test';
import assert from 'node:assert/strict';
import { progressSnapshot, createProgressTracker, createProgressSender } from './playbackProgress.js';

const snapshot = (overrides = {}) => ({ ownerId: 'owner', token: 'access-token', episodeId: 'episode-a', position: 10, duration: 100, ...overrides });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('normalizes finite positions and records natural completion at the duration', () => {
  assert.equal(progressSnapshot(snapshot({ position: -5 })).position, 0);
  assert.equal(progressSnapshot(snapshot({ position: 105 })).position, 100);
  assert.equal(progressSnapshot(snapshot({ position: 95 })).completed, true);
  assert.equal(progressSnapshot(snapshot({ position: 20 }), true).position, 100);
  assert.equal(progressSnapshot(snapshot({ position: 20 }), true).completed, true);
  for (const invalid of [{ duration: NaN }, { duration: Infinity }, { duration: 0 }, { position: NaN }, { position: Infinity }, { token: null }, { ownerId: null }]) {
    assert.equal(progressSnapshot(snapshot(invalid)), null);
  }
});

test('keeps one timer through continuous time updates and reads the latest position each tick', async () => {
  let current = snapshot();
  let callback;
  let scheduled = 0;
  const sent = [];
  const tracker = createProgressTracker({ getSnapshot: () => current, send: async value => sent.push(value),
    setIntervalFn: (fn, ms) => { assert.equal(ms, 10000); callback = fn; scheduled++; return 1; }, clearIntervalFn() {} });
  tracker.start();
  for (let position = 1; position <= 40; position++) {
    current = snapshot({ position });
    tracker.start();
    if (position % 10 === 0) callback();
  }
  await tracker.flush();
  assert.equal(scheduled, 1);
  assert.deepEqual(sent.map(value => value.position), [10, 20, 30, 40]);
});

test('captures outgoing episode progress before a switch and serializes slow saves', async () => {
  let current = snapshot({ position: 42 });
  let release;
  const sent = [];
  const tracker = createProgressTracker({ getSnapshot: () => current, send: async value => {
    sent.push(value);
    if (sent.length === 1) await new Promise(resolve => { release = resolve; });
  } });
  const first = tracker.save();
  current = snapshot({ episodeId: 'episode-b', position: 3, duration: 200 });
  const second = tracker.save();
  await tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].episodeId, 'episode-a');
  assert.equal(sent[0].position, 42);
  release();
  await Promise.all([first, second]);
  assert.equal(sent[1].episodeId, 'episode-b');
  assert.equal(sent[1].position, 3);
  assert.equal(tracker.latest('owner', 'episode-a').position, 42);
  assert.equal(tracker.latest('another-owner', 'episode-a'), undefined);
});

test('stops its timer on pause/close and records completion separately from the next episode', async () => {
  const sent = [];
  const cleared = [];
  const tracker = createProgressTracker({ getSnapshot: () => snapshot({ position: 99 }), send: async value => sent.push(value),
    setIntervalFn: () => 7, clearIntervalFn: id => cleared.push(id) });
  tracker.start();
  await tracker.stop({ completed: true });
  assert.deepEqual(cleared, [7]);
  assert.equal(sent[0].position, 100);
  assert.equal(sent[0].completed, true);
  tracker.clear();
  assert.equal(tracker.latest('owner', 'episode-a'), undefined);
});

test('failed writes do not block subsequent saves or become unhandled rejections', async () => {
  const errors = [];
  let attempts = 0;
  const tracker = createProgressTracker({ getSnapshot: () => snapshot(), onError: error => errors.push(error.message), send: async () => {
    if (++attempts === 1) throw new Error('Offline');
  } });
  assert.equal(await tracker.save(), false);
  assert.equal(await tracker.save(), true);
  assert.deepEqual(errors, ['Offline']);
});

test('page-lifecycle saves preserve their captured token and enable keepalive', async () => {
  let call;
  const send = createProgressSender('https://library.example/api', async (url, options) => {
    call = { url, options };
    return new Response(null, { status: 200 });
  });
  await send(snapshot({ position: 77 }), { keepalive: true });
  assert.equal(call.options.keepalive, true);
  assert.equal(call.options.headers.Authorization, 'Bearer access-token');
  assert.equal(call.url, 'https://library.example/api/episodes/episode-a/progress');
  assert.deepEqual(JSON.parse(call.options.body), { position: 77, duration: 100 });
});
