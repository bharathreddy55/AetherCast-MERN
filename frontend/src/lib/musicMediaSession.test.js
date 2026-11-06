import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicMediaSession, musicPositionState } from './musicMediaSession.js';
function fixture() {
  const handlers = new Map(), calls = [], positions = [];
  const session = { metadata: null, playbackState: 'none', setActionHandler: (action, handler) => handlers.set(action, handler), setPositionState: value => positions.push(value) };
  let state = { allowed: true, ready: true, hasNext: true, hasPrevious: true,
    track: { kind: 'track', _id: 'one', title: 'Song', artistCredits: [{ artist: { name: 'Artist' } }], album: { title: 'Album' }, audioUrl: 'secret', coverImage: 'secret', ownerId: 'secret' },
    audio: { duration: 100, currentTime: 40, playbackRate: 1, paused: false, ended: false } };
  const commands = Object.fromEntries(['play', 'pause', 'stop', 'next', 'previous', 'seek'].map(action => [action, (...args) => calls.push([action, ...args])]));
  class Metadata { constructor(value) { Object.assign(this, value); } }
  const bridge = createMusicMediaSession({ session, Metadata, getSnapshot: () => state, getCommands: () => commands });
  return { session, handlers, calls, positions, bridge, commands, state, setState: value => { state = value; } };
}
test('OS metadata includes only music labels, never account fields or private audio/artwork URLs', () => {
  const f = fixture(); f.bridge.update();
  assert.equal(f.session.metadata.title, 'Song'); assert.equal(f.session.metadata.artist, 'Artist'); assert.equal(f.session.metadata.album, 'Album');
  assert.deepEqual(f.session.metadata.artwork, []); assert.equal(JSON.stringify(f.session.metadata).includes('secret'), false);
  assert.equal(f.session.playbackState, 'playing'); assert.deepEqual(f.positions.at(-1), { duration: 100, position: 40, playbackRate: 1 });
});
test('play/pause/stop are distinct commands and callbacks use current queue/track state', () => {
  const f = fixture(); f.bridge.update(); const next = f.handlers.get('nexttrack');
  f.handlers.get('play')(); f.handlers.get('pause')(); f.handlers.get('stop')();
  assert.deepEqual(f.calls, [['play'], ['pause'], ['stop']]);
  f.state.hasNext = false; next(); assert.equal(f.calls.length, 3);
  f.state.hasNext = true; next(); assert.deepEqual(f.calls.at(-1), ['next']);
  f.commands.next = () => f.calls.push(['latest']); next(); assert.deepEqual(f.calls.at(-1), ['latest']);
});
test('seek actions validate input, use live position and clamp both ends without autoplay', () => {
  const f = fixture(); f.bridge.update();
  f.handlers.get('seekforward')(); f.handlers.get('seekbackward')({ seekOffset: 100 }); f.handlers.get('seekto')({ seekTime: 500 });
  f.state.audio.currentTime = 80; f.handlers.get('seekforward')({ seekOffset: 5 });
  assert.deepEqual(f.calls, [['seek', 50], ['seek', 0], ['seek', 100], ['seek', 85]]);
  for (const details of [{ seekOffset: -1 }, { seekOffset: Infinity }, { seekOffset: '5' }]) f.handlers.get('seekforward')(details);
  for (const details of [{}, { seekTime: NaN }, { seekTime: '5' }]) f.handlers.get('seekto')(details);
  assert.equal(f.calls.length, 4);
});
test('queue boundaries and unloaded duration disable unsupported commands without inventing position', () => {
  const f = fixture(); f.state.hasNext = false; f.state.hasPrevious = false; f.state.ready = false; f.bridge.update();
  assert.equal(f.handlers.get('nexttrack'), null); assert.equal(f.handlers.get('previoustrack'), null); assert.equal(f.handlers.get('seekto'), null);
  assert.equal(f.positions.at(-1), undefined);
  assert.equal(typeof f.handlers.get('play'), 'function');
});
test('pending music resolution can be cancelled by pause/stop but never resumed by a retained play handler', () => {
  const f = fixture(); f.bridge.update(); const play = f.handlers.get('play');
  f.setState({ ...f.state, allowed: false, canCancel: true }); f.bridge.update();
  assert.equal(f.session.metadata, null); assert.equal(f.handlers.get('play'), null);
  play(); f.handlers.get('pause')(); f.handlers.get('stop')();
  assert.deepEqual(f.calls, [['pause'], ['stop']]);
  f.setState({ ...f.state, allowed: false, canCancel: false }); f.bridge.update();
  assert.equal(f.handlers.get('pause'), null);
});
test('paused, buffering, ended and error state never advertise ongoing playback', () => {
  const f = fixture();
  for (const patch of [{ paused: true }, { ended: true }, { error: {} }]) {
    f.setState({ ...f.state, audio: { ...f.state.audio, ...patch } }); f.bridge.update(); assert.equal(f.session.playbackState, 'paused');
  }
  f.setState({ ...f.state, buffering: true }); f.bridge.update(); assert.equal(f.session.playbackState, 'paused');
});
test('logout, absent media and podcast switching clear all OS state and fence retained handlers', () => {
  for (const update of [state => ({ ...state, allowed: false }), state => ({ ...state, track: null }), state => ({ ...state, track: { _id: 'podcast' } })]) {
    const f = fixture(); f.bridge.update(); const saved = f.handlers.get('play');
    f.setState(update(f.state)); f.bridge.update(); saved();
    assert.equal(f.session.metadata, null); assert.equal(f.session.playbackState, 'none'); assert.equal(f.positions.at(-1), undefined);
    assert.ok([...f.handlers.values()].every(value => value === null)); assert.deepEqual(f.calls, []);
  }
});
test('dispose clears listeners/metadata and late callbacks cannot revive or change the session', () => {
  const f = fixture(); f.bridge.update(); const saved = f.handlers.get('nexttrack'); f.bridge.dispose();
  saved(); f.bridge.update(); assert.deepEqual(f.calls, []); assert.equal(f.session.metadata, null);
});
test('missing APIs, unsupported actions and throwing setters degrade independently', () => {
  const f = fixture(); const set = f.session.setActionHandler;
  f.session.setActionHandler = (action, handler) => { if (action === 'seekto') throw new Error('unsupported'); set(action, handler); };
  f.session.setPositionState = () => { throw new Error('unavailable'); };
  assert.doesNotThrow(() => f.bridge.update()); assert.equal(typeof f.handlers.get('pause'), 'function');
  const broken = createMusicMediaSession({ session: f.session, Metadata: class { constructor() { throw new Error('unsupported'); } }, getSnapshot: () => f.state, getCommands: () => f.commands });
  assert.doesNotThrow(() => broken.update()); assert.equal(f.session.metadata, null);
  const absent = createMusicMediaSession({ getSnapshot: () => null, getCommands: () => ({}) });
  assert.doesNotThrow(() => { absent.update(); absent.dispose(); });
});
test('invalid/unknown duration, rate and position clear the position state safely', () => {
  const audio = { duration: 100, currentTime: 120, playbackRate: 1 };
  assert.deepEqual(musicPositionState(audio), { duration: 100, position: 100, playbackRate: 1 });
  assert.equal(musicPositionState({ ...audio, duration: Infinity }), null);
  assert.equal(musicPositionState({ ...audio, duration: 0 }), null);
  assert.equal(musicPositionState({ ...audio, currentTime: NaN }), null);
  assert.equal(musicPositionState({ ...audio, playbackRate: 0 }), null);
});
