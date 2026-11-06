import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicLinkRenewal, musicLinkExpiry, musicLinkNeedsRenewal } from './musicLinkRenewal.js';
const settle = () => new Promise(resolve => setImmediate(resolve));
function setup(overrides = {}) {
  let clock = 850000;
  const timers = new Map(), calls = [], failures = [];
  const state = { allowed: true, loading: false, playIntent: true, quality: 'original',
    media: { ownerId: 'owner', ready: true, quality: 'original', requestId: 1, expiresAt: 900000, source: '/media/old',
      episode: { _id: 'song', kind: 'track', queueItemId: 'occurrence' } },
    audio: { currentTime: 42, paused: false, ended: false, error: { code: 2 } } };
  const renewal = createMusicLinkRenewal({ getSnapshot: () => state, now: () => clock,
    renew: value => { calls.push(value); return overrides.renew?.(value); }, onFailure: () => failures.push(true),
    schedule: (fn, ms) => { assert.equal(ms, 8000); const key = {}; timers.set(key, fn); return key; }, unschedule: key => timers.delete(key) });
  return { state, renewal, calls, failures, timers, advance: ms => { clock += ms; }, fire: () => { const handlers = [...timers.values()]; timers.clear(); for (const fn of handlers) fn(); } };
}

test('expiry comes from a bounded authenticated lifetime and reserves one minute of headroom', () => {
  assert.equal(musicLinkExpiry(900, 1000), 901000);
  for (const ttl of [undefined, null, '900', 0, -1, Infinity, 1.2, 86401]) assert.equal(musicLinkExpiry(ttl, 1000), null);
  assert.equal(musicLinkExpiry(900, NaN), null);
  assert.equal(musicLinkNeedsRenewal({ expiresAt: 901000 }, 840999), false);
  assert.equal(musicLinkNeedsRenewal({ expiresAt: 901000 }, 841000), true);
  assert.equal(musicLinkNeedsRenewal({ expiresAt: null }, 1000000), false);
});

test('expired-link errors renew the same occurrence at its live position and playing intent', async () => {
  const h = setup(); h.state.audio.paused = true; // Browsers may pause after a media error.
  assert.equal(h.renewal.interrupted(), true);
  assert.deepEqual(h.calls[0], { item: h.state.media.episode, position: 42, keepPaused: false, automatic: true });
  assert.equal(h.renewal.interrupted(), false); await settle();
  assert.equal(h.renewal.interrupted(), false); // Cooldown still applies after the request finishes.
});

test('healthy playback never causes a timer or periodic source reload', () => {
  const h = setup(); h.advance(1800000);
  h.renewal.playing(); assert.equal(h.calls.length, 0); assert.equal(h.timers.size, 0);
});
test('normalized quality uses the same expiry recovery identity without changing the requested version', () => {
  const h = setup(); h.state.quality = 'normalized'; h.state.media.quality = 'normalized';
  assert.equal(h.renewal.interrupted(), true); assert.equal(h.calls[0].item, h.state.media.episode);
});

test('a media error that resets the element position retains the last known progress', () => {
  const h = setup(); h.state.audio.currentTime = 0; h.state.media.lastPosition = 42;
  h.renewal.interrupted(); assert.equal(h.calls[0].position, 42);
});

test('fresh URLs, decode/abort errors, paused intent and unavailable/foreign state never auto-refresh', () => {
  const patches = [s => { s.allowed = false; }, s => { s.loading = true; }, s => { s.media.ready = false; },
    s => { s.playIntent = false; }, s => { s.media.episode.kind = 'episode'; }, s => { s.media.source = 'blob:local'; },
    s => { s.media.expiresAt = null; }, s => { s.media.expiresAt = 9999999; }, s => { s.quality = 'compatible'; },
    s => { s.audio.ended = true; }, s => { s.audio.error.code = 3; }, s => { s.audio.error.code = 1; }, s => { s.audio.error = null; }];
  for (const patch of patches) {
    const h = setup(); patch(h.state); assert.equal(h.renewal.interrupted(), false); assert.equal(h.calls.length, 0);
  }
});

test('only a sustained expired-link stall at the same source and position renews', () => {
  const h = setup(); h.state.audio.error = null;
  h.renewal.waiting(); h.renewal.waiting(); assert.equal(h.timers.size, 1); assert.equal(h.calls.length, 0);
  h.advance(8000); h.fire(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].position, 42);
});

test('progress, source/owner/queue/quality changes, pause, lock and load cancel an observed stall', () => {
  const changes = [h => { h.state.audio.currentTime += 2; }, h => { h.state.media.source = '/media/new'; },
    h => { h.state.media.requestId++; }, h => { h.state.media.ownerId = 'different'; }, h => { h.state.media.episode.queueItemId = 'repeat'; },
    h => { h.state.quality = 'compatible'; }, h => { h.state.playIntent = false; }, h => { h.state.audio.paused = true; },
    h => { h.state.allowed = false; }, h => { h.state.loading = true; }, h => h.renewal.cancel(), h => h.renewal.playing(), h => h.renewal.reset()];
  for (const change of changes) {
    const h = setup(); h.renewal.waiting(); change(h); h.fire(); assert.equal(h.calls.length, 0);
  }
});

test('paused or fresh buffering does not create recovery timers', () => {
  for (const change of [s => { s.playIntent = false; }, s => { s.audio.paused = true; }, s => { s.media.expiresAt = 9999999; }]) {
    const h = setup(); change(h.state); h.renewal.waiting(); assert.equal(h.timers.size, 0);
  }
});

test('automatic retries have a cooldown and rolling limit that persists across attached links', async () => {
  const h = setup(); assert.equal(h.renewal.interrupted(), true); await settle();
  h.advance(59999); assert.equal(h.renewal.interrupted(), false);
  h.advance(1); h.state.media = { ...h.state.media, source: '/media/new', requestId: 2 };
  assert.equal(h.renewal.interrupted(), true); await settle();
  h.advance(60000); assert.equal(h.renewal.interrupted(), false);
  h.advance(600000); assert.equal(h.renewal.interrupted(), true); await settle();
});

test('a different queue occurrence has its own bounded recovery budget', async () => {
  const h = setup(); h.renewal.interrupted(); await settle();
  h.state.media = { ...h.state.media, episode: { ...h.state.media.episode, queueItemId: 'repeat' } };
  assert.equal(h.renewal.interrupted(), true); await settle();
});

test('an exhausted stall budget reports recovery failure instead of silently buffering forever', async () => {
  const h = setup(); h.renewal.interrupted(); await settle(); h.advance(60000);
  h.renewal.interrupted(); await settle(); h.advance(60000);
  h.renewal.waiting(); h.advance(8000); h.fire();
  assert.equal(h.calls.length, 2); assert.equal(h.failures.length, 1); assert.equal(h.timers.size, 0);
});

test('explicit seeking refreshes an old link at the requested position without unpausing', async () => {
  const h = setup(); h.state.playIntent = false; h.state.audio.paused = true;
  assert.equal(h.renewal.seek(73), true); assert.equal(h.calls[0].position, 73); assert.equal(h.calls[0].keepPaused, true);
  assert.equal(h.calls[0].automatic, false); await settle();
  assert.equal(h.renewal.seek(NaN), false); h.state.media.expiresAt = 9999999; assert.equal(h.renewal.seek(10), false);
});

test('rejected refresh reports once, does not loop or reuse a cached URL', async () => {
  const h = setup({ renew: async () => { throw new Error('Denied'); } });
  h.renewal.interrupted(); await settle(); assert.equal(h.failures.length, 1); assert.equal(h.calls.length, 1);
  assert.equal(h.renewal.interrupted(), false); h.fire(); assert.equal(h.calls.length, 1);
});

test('late rejection after logout, source replacement or reset cannot publish an old error', async () => {
  for (const change of [h => { h.state.allowed = false; }, h => { h.state.media = { ...h.state.media, source: '/new' }; }, h => h.renewal.reset()]) {
    let reject; const h = setup({ renew: () => new Promise((_, no) => { reject = no; }) });
    h.renewal.interrupted(); change(h); reject(new Error('old')); await settle(); assert.equal(h.failures.length, 0);
  }
});

test('old promise completion cannot clear a newer pending recovery', async () => {
  const work = []; const h = setup({ renew: () => new Promise(resolve => work.push(resolve)) });
  h.renewal.interrupted(); h.renewal.reset(); h.renewal.interrupted();
  work[0](); await settle(); assert.equal(h.renewal.seek(10), false);
  work[1](); await settle(); assert.equal(h.renewal.seek(10), true); work[2](); await settle();
});
