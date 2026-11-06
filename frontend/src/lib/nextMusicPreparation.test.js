import test from 'node:test';
import assert from 'node:assert/strict';
import { createNextMusicPreparation, readNextPreparation, saveNextPreparation, shouldPrepareNext, atMusicBoundary } from './nextMusicPreparation.js';
const key = () => ({ ownerId: 'owner', token: 'test-session', quality: 'original', from: 'first', to: 'next', requestId: 1, trackId: 'song' });
const track = () => ({ kind: 'track', _id: 'song', queueItemId: 'next' });
const resolved = () => ({ episode: { ...track(), audioUrl: '/media/prepared', playback: { variant: 'original' } }, expiresIn: 900, downloadedResponse: null });
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(loader = async () => resolved()) {
  let clock = 0; const calls = [], timers = new Map();
  const cache = createNextMusicPreparation({ load: (item, options) => { calls.push({ item, options }); return loader(item, options); }, now: () => clock,
    schedule: (fn, ms) => { assert.equal(ms, 15000); const id = {}; timers.set(id, fn); return id; }, unschedule: id => timers.delete(id) });
  return { cache, calls, timers, advance: ms => { clock += ms; }, timeout: () => { for (const fn of [...timers.values()]) fn(); } };
}
test('preparation is enabled by default and stores only a non-secret explicit preference', () => {
  assert.equal(readNextPreparation({ getItem: () => null }), true);
  assert.equal(readNextPreparation({ getItem: () => 'off' }), false);
  assert.equal(readNextPreparation({ getItem: () => { throw new Error(); } }), true);
  const writes = []; saveNextPreparation({ setItem: (...args) => writes.push(args) }, false);
  assert.deepEqual(writes, [['music.prepareNext', 'off']]);
  assert.doesNotThrow(() => saveNextPreparation({ setItem: () => { throw new Error(); } }, true));
});
const eligible = () => ({ enabled: true, allowed: true, loading: false, buffering: false,
  media: { ready: true, episode: { kind: 'track' } }, audio: { duration: 120, currentTime: 110, paused: false, ended: false, error: null }, next: { track: track() } });
test('only active music in the final fifteen seconds with a natural next item qualifies', () => {
  assert.equal(shouldPrepareNext(eligible()), true);
  const changes = [s => { s.enabled = false; }, s => { s.allowed = false; }, s => { s.loading = true; }, s => { s.buffering = true; },
    s => { s.audio.paused = true; }, s => { s.audio.ended = true; }, s => { s.audio.error = {}; }, s => { s.audio.duration = Infinity; },
    s => { s.audio.currentTime = 0; }, s => { s.audio.currentTime = 120; }, s => { s.audio.duration = 20; s.audio.currentTime = 15; },
    s => { s.media.ready = false; }, s => { s.media.episode.kind = 'episode'; }, s => { s.next = null; }];
  for (const change of changes) { const state = eligible(); change(state); assert.equal(shouldPrepareNext(state), false); }
});
test('the final timeupdate/pause is a boundary before ended and must not discard prepared work', () => {
  assert.equal(atMusicBoundary({ duration: 120, currentTime: 120, ended: false }), true);
  assert.equal(atMusicBoundary({ duration: 120, currentTime: 119.9, ended: false }), false);
  assert.equal(atMusicBoundary({ duration: Infinity, currentTime: 10, ended: false }), false);
});
test('one lookup is shared across time updates and a valid natural handoff consumes it once', async () => {
  const h = setup(); assert.equal(h.cache.prepare(key(), track()), true); assert.equal(h.cache.prepare(key(), track()), false);
  await flush(); const result = await h.cache.take(key(), new AbortController().signal);
  assert.equal(h.calls.length, 1); assert.equal(result.resolved.episode.audioUrl, '/media/prepared'); assert.equal(result.requestedAt, 0);
  assert.equal(await h.cache.take(key(), new AbortController().signal), undefined); assert.equal(h.timers.size, 0);
});
test('an in-flight lookup can be handed to the matching natural transition without another request', async () => {
  let finish; const h = setup(() => new Promise(resolve => { finish = resolve; }));
  h.cache.prepare(key(), track()); await flush(); const pending = h.cache.take(key(), new AbortController().signal);
  finish(resolved()); assert.ok(await pending); assert.equal(h.calls.length, 1);
});
test('owner, credential, quality, occurrence, request and track changes cannot reuse a prepared link', async () => {
  for (const patch of [{ ownerId: 'other' }, { token: 'new-session' }, { quality: 'normalized' }, { from: 'other' }, { to: 'repeat' }, { requestId: 2 }, { trackId: 'other-song' }]) {
    const h = setup(); h.cache.prepare(key(), track()); await flush();
    assert.equal(await h.cache.take({ ...key(), ...patch }, new AbortController().signal), undefined);
    assert.equal(h.calls[0].options.signal.aborted, true);
  }
});
test('stale, short-lived, missing-TTL and malformed/incorrect-quality responses fall back to normal selection', async () => {
  const variants = [value => { value.expiresIn = 30; }, value => { delete value.expiresIn; }, value => { value.episode._id = 'wrong'; },
    value => { value.episode.queueItemId = 'repeat'; }, value => { value.episode.playback.variant = 'compatible'; }, value => { value.episode.audioUrl = ''; }, value => { value.downloadedResponse = {}; }];
  for (const change of variants) {
    const value = resolved(); change(value); const h = setup(async () => value);
    h.cache.prepare(key(), track()); await flush(); assert.equal(await h.cache.take(key(), new AbortController().signal), undefined);
  }
  const h = setup(); h.cache.prepare(key(), track()); await flush(); h.advance(30000);
  assert.equal(await h.cache.take(key(), new AbortController().signal), undefined);
});
test('pausing/seeking/locking cancellation drops the response and does not retry automatically in the same window', async () => {
  const h = setup(); h.cache.prepare(key(), track()); await flush(); h.cache.cancel();
  assert.equal(await h.cache.take(key(), new AbortController().signal), undefined);
  assert.equal(h.cache.prepare(key(), track()), false); assert.equal(h.calls[0].options.signal.aborted, true);
  h.cache.reset(); assert.equal(h.cache.prepare(key(), track()), true); await flush(); h.cache.reset();
});
test('changed queue targets cancel old work and late old results cannot replace the new target', async () => {
  const work = []; const h = setup(() => new Promise(resolve => work.push(resolve)));
  h.cache.prepare(key(), track()); await flush();
  const nextKey = { ...key(), to: 'new', trackId: 'new-song' }, nextTrack = { ...track(), _id: 'new-song', queueItemId: 'new' };
  h.cache.prepare(nextKey, nextTrack); await flush(); assert.equal(h.calls[0].options.signal.aborted, true);
  work[0](resolved()); work[1]({ ...resolved(), episode: { ...resolved().episode, ...nextTrack } });
  assert.equal((await h.cache.take(nextKey, new AbortController().signal)).resolved.episode._id, 'new-song');
});
test('timeout and ignored aborts never leave preparation or handoff waiting indefinitely', async () => {
  const h = setup(() => new Promise(() => {})); h.cache.prepare(key(), track()); await flush(); h.timeout();
  assert.equal(await h.cache.take(key(), new AbortController().signal), undefined); assert.equal(h.timers.size, 0);
  h.cache.reset(); h.cache.prepare(key(), track()); await flush(); const controller = new AbortController();
  const waiting = h.cache.take(key(), controller.signal); controller.abort(); await assert.rejects(waiting, { name: 'AbortError' });
  await flush(); assert.equal(h.timers.size, 0);
});
test('speculative failure is contained and does not become a cached playback source or an unhandled rejection', async () => {
  const h = setup(async () => { throw new Error('Denied'); }); h.cache.prepare(key(), track()); await flush();
  assert.equal(await h.cache.take(key(), new AbortController().signal), undefined); assert.equal(h.cache.prepare(key(), track()), false);
});
test('invalid identities never start network work', async () => {
  const h = setup(); assert.equal(h.cache.prepare({ ...key(), token: '' }, track()), false);
  assert.equal(h.cache.prepare(key(), { ...track(), queueItemId: 'wrong' }), false); await flush(); assert.equal(h.calls.length, 0);
});
