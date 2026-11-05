import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicListeningTracker, createMusicListeningSender } from './musicListening.js';
const track = { _id: 'song', duration: 180 };
function fixture(send) {
  let time = 0, nextId = 0, auth = { ownerId: 'owner', token: 'current-token' };
  const events = [], errors = [];
  const tracker = createMusicListeningTracker({ now: () => time, makeId: () => `play-${++nextId}`, getAuth: () => auth,
    send: send || (async (event, options) => { events.push({ ...event, ...options }); }), onError: () => errors.push('failed') });
  const attach = (queueItemId = 'first') => tracker.attach({ track, queueItemId, ownerId: 'owner' });
  return { tracker, attach, events, errors, advance: seconds => { time += seconds * 1000; }, setAuth: value => { auth = value; } };
}
test('loading or pausing an unplayed song never records a listen', async () => {
  const f = fixture(); f.attach(); f.advance(10); f.tracker.pause(); f.tracker.reset(0);
  await f.tracker.flush(); assert.deepEqual(f.events, []);
});
test('actual playing starts once and pause/buffering time does not count', async () => {
  const f = fixture(); f.attach(); f.tracker.playing(); f.tracker.playing(); f.advance(10); f.tracker.pause();
  f.advance(60); f.tracker.playing(10); f.advance(5); f.tracker.finish('skipped', 130);
  await f.tracker.flush();
  assert.deepEqual(f.events.map(event => event.type), ['started', 'skipped']);
  assert.equal(f.events[1].playedSeconds, 15);
  assert.equal(f.events[1].position, 130);
  assert.equal(f.events[0].playbackId, f.events[1].playbackId);
});
test('refreshing the same occurrence keeps the listening ID and accumulated time', async () => {
  const f = fixture(); f.attach(); f.tracker.playing(); f.advance(8); f.tracker.pause(); f.attach();
  f.advance(30); f.tracker.playing(8); f.advance(4); f.tracker.finish('completed', 180);
  await f.tracker.flush();
  assert.equal(f.events.length, 2);
  assert.equal(f.events[1].playedSeconds, 12);
  assert.equal(f.events[1].playbackId, f.events[0].playbackId);
});
test('repeat completion creates a new playback session while a late skip cannot duplicate the completed one', async () => {
  const f = fixture(); f.attach(); f.tracker.playing(); f.advance(180); f.tracker.finish('completed', 180); f.tracker.finish('skipped', 180);
  f.attach(); f.tracker.playing(); f.advance(5); f.tracker.finish('skipped', 5);
  await f.tracker.flush();
  assert.deepEqual(f.events.map(event => event.type), ['started', 'completed', 'started', 'skipped']);
  assert.notEqual(f.events[0].playbackId, f.events[2].playbackId);
});
test('two queued occurrences of a song remain separate listening sessions', async () => {
  const f = fixture(); f.attach('first'); f.tracker.playing(); f.advance(2); f.tracker.finish('skipped', 2);
  f.attach('second'); f.tracker.playing(); f.advance(4); f.tracker.finish('skipped', 4);
  await f.tracker.flush();
  assert.notEqual(f.events[0].playbackId, f.events[2].playbackId);
  assert.equal(f.events[3].playedSeconds, 4);
});
test('history writes stay ordered and a failed write does not block later outcomes', async () => {
  const calls = [];
  const f = fixture(async event => { calls.push(event.type); if (event.type === 'started') throw new Error('offline'); });
  f.attach(); f.tracker.playing(); f.advance(5); f.tracker.finish('skipped', 5);
  await f.tracker.flush();
  assert.deepEqual(calls, ['started', 'skipped']); assert.equal(f.errors.length, 1);
});
test('logout uses a captured owner token for its final best-effort event and resets identity', async () => {
  const f = fixture(); f.attach(); f.tracker.playing(); f.advance(5); f.setAuth({ ownerId: null, token: null });
  f.tracker.reset(5, { keepalive: true }); f.tracker.playing(); await f.tracker.flush();
  assert.equal(f.events.length, 2);
  assert.equal(f.events[1].token, 'current-token'); assert.equal(f.events[1].keepalive, true);
});
test('sender uses stable session identity, keeps credentials out of event bodies and reports HTTP failures', async () => {
  const calls = [];
  const send = createMusicListeningSender('https://library.example/api', async (...args) => { calls.push(args); return { ok: true }; });
  const event = { playbackId: 'play-id', token: 'private-token', trackId: 'song', type: 'started', position: 0, playedSeconds: 0 };
  await send(event, { keepalive: true });
  assert.equal(calls[0][0], 'https://library.example/api/music/library/events/play-id');
  assert.equal(calls[0][1].method, 'PUT');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer private-token');
  assert.equal(JSON.stringify(JSON.parse(calls[0][1].body)).includes('private-token'), false);
  assert.equal(calls[0][1].keepalive, true);
  await assert.rejects(createMusicListeningSender('https://library.example/api', async () => ({ ok: false }))(event), /could not be saved/);
});
