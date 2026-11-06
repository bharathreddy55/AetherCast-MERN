import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryPosition, createAudioPlayback } from './playbackRecovery.js';
const item = { kind: 'track', _id: 'song', queueItemId: 'occurrence' };
test('refresh uses live position; failed refresh retry preserves only the same owner and occurrence in memory', () => {
  const options = { item, active: item, audio: { currentTime: 42, ended: false }, ownerId: 'owner' };
  assert.equal(recoveryPosition(options), 42);
  const retry = { ownerId: 'owner', item, position: 42 };
  assert.equal(recoveryPosition({ ...options, active: null, audio: { currentTime: 0 }, retry }), 42);
  for (const patch of [{ ownerId: 'other' }, { item: { ...item, queueItemId: 'repeat' } }, { item: { ...item, _id: 'different' } }, { restart: true }]) assert.equal(recoveryPosition({ ...options, active: null, retry, ...patch }), 0);
  assert.equal(recoveryPosition({ ...options, active: null, retry: null }), 0);
  assert.equal(recoveryPosition({ ...options, audio: { currentTime: 100, ended: true } }), 0);
});
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
test('duplicate play actions share a pending attempt and never toggle an already playing song', async () => {
  const work = deferred(); let calls = 0; const audio = { paused: true, play: () => { ++calls; return work.promise; } };
  const controls = createAudioPlayback({ getAudio: () => audio, canPlay: () => true, getRevision: () => 1, onError: () => {} });
  controls.play(1); controls.play(1); assert.equal(calls, 1); assert.equal(controls.pending(), true);
  work.resolve(); await settle(); assert.equal(controls.pending(), false);
  audio.paused = false; controls.play(1); assert.equal(calls, 1);
});
test('pause/logout cancellation suppresses stale rejection and does not clear a newer pending attempt', async () => {
  const old = deferred(), fresh = deferred(); let revision = 1, allowed = true, calls = 0; const errors = [];
  const controls = createAudioPlayback({ getAudio: () => ({ paused: true, play: () => ++calls === 1 ? old.promise : fresh.promise }), canPlay: () => allowed, getRevision: () => revision, onError: value => errors.push(value) });
  controls.play(1); revision = 2; controls.cancel(); controls.play(2);
  old.reject(new Error('old')); await settle(); assert.equal(controls.pending(), true); assert.deepEqual(errors, []);
  allowed = false; revision = 3; controls.cancel(); fresh.reject(new Error('after logout')); await settle();
  controls.play(3); assert.equal(calls, 2); assert.deepEqual(errors, []);
});
test('blocked autoplay/synchronous play failures report once and leave explicit retry available', async () => {
  for (const play of [() => Promise.reject(new Error('blocked')), () => { throw new Error('blocked'); }]) {
    const errors = []; const controls = createAudioPlayback({ getAudio: () => ({ paused: true, play }), canPlay: () => true, getRevision: () => 1, onError: value => errors.push(value) });
    controls.play(1); await settle(); assert.equal(controls.pending(), false); assert.equal(errors.length, 1);
    controls.play(1); await settle(); assert.equal(errors.length, 2);
  }
});
