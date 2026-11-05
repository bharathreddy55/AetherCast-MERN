import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyMusicQueue, musicQueueReducer as reduce, musicEntries, queueEntry, orderedQueue, nextQueueId, previousQueueId, loadMusicContext, MAX_QUEUE_SIZE } from './musicQueue.js';
import { sameMedia, initialPlaybackPosition, resolvePlayerMedia } from './musicPlayback.js';

const track = id => ({ _id: id, kind: 'track', title: id });
const entries = names => musicEntries(names.map(track), 'context', (() => { let n = 0; return () => `entry-${++n}`; })());
const start = (names = ['a', 'b', 'c']) => reduce(emptyMusicQueue(), { type: 'replace', items: entries(names) });
const add = (state, id, next = false) => reduce(state, { type: 'add', entry: { queueItemId: `manual-${id}`, track: track(id) }, next });
const titles = state => orderedQueue(state).map(entry => entry.track._id);

test('each occurrence has independent identity and repeating the same song starts at zero', () => {
  const state = start(['a', 'a', 'b']);
  assert.equal(new Set(state.items.map(item => item.queueItemId)).size, 3);
  const first = { ...state.items[0].track, queueItemId: state.items[0].queueItemId };
  const second = { ...state.items[1].track, queueItemId: state.items[1].queueItemId };
  assert.equal(sameMedia(first, second), false);
  assert.equal(sameMedia(first, track('a')), true);
  assert.equal(initialPlaybackPosition(second, first, { currentTime: 50, ended: false }), 0);
  assert.equal(queueEntry(reduce(state, { type: 'next' })).queueItemId, second.queueItemId);
});

test('fresh playback resolution retains the queue occurrence when the backend returns a track DTO', async () => {
  const result = await resolvePlayerMedia({ ...track('a'), queueItemId: 'unique' }, {
    fetchTrack: async () => ({ ok: true, json: async () => ({ success: true, track: { ...track('a'), audioUrl: 'fresh' } }) }),
  });
  assert.equal(result.episode.queueItemId, 'unique');
});

test('manual next-up entries precede collection context and queue additions retain their order', () => {
  let state = add(start(), 'one');
  state = add(state, 'two');
  state = add(state, 'immediate', true);
  assert.deepEqual(titles(state), ['a', 'immediate', 'one', 'two', 'b', 'c']);
  assert.equal(queueEntry(state, state.order[1]).source, 'manual');
  assert.equal(queueEntry(state, state.order[4]).source, 'context');
});

test('adding to an empty queue creates a selectable occurrence without deciding to autoplay', () => {
  const state = add(emptyMusicQueue(), 'one');
  assert.equal(queueEntry(state).track._id, 'one');
  assert.equal(nextQueueId(state), null);
});

test('queue ends without wrapping when repeat is off', () => {
  let state = start(['a', 'b']);
  assert.equal(previousQueueId(state), null);
  state = reduce(state, { type: 'next', natural: true });
  assert.equal(queueEntry(state).track._id, 'b');
  assert.equal(nextQueueId(state, true), null);
  assert.equal(reduce(state, { type: 'next' }), state);
});

test('repeat-one applies to natural completion while explicit next advances', () => {
  const state = reduce(start(), { type: 'repeat', value: 'one' });
  assert.equal(nextQueueId(state, true), state.currentId);
  assert.notEqual(nextQueueId(state, false), state.currentId);
  assert.equal(queueEntry(reduce(state, { type: 'next' })).track._id, 'b');
});

test('repeat-all wraps at the end and single-item queues can restart', () => {
  let state = reduce(start(['a', 'b']), { type: 'repeat', value: 'all' });
  state = reduce(state, { type: 'next' });
  assert.equal(nextQueueId(state, true), state.order[0]);
  assert.equal(queueEntry(reduce(state, { type: 'next' })).track._id, 'a');
  const single = reduce(start(['a']), { type: 'repeat', value: 'all' });
  assert.equal(nextQueueId(single, true), single.currentId);
});

test('shuffle is stable between actions, retains current/manual priorities, and restores remaining album order', () => {
  let state = add(start(['a', 'b', 'c', 'd']), 'manual', true);
  const current = state.currentId;
  state = reduce(state, { type: 'shuffle' }, () => 0);
  assert.equal(state.currentId, current);
  assert.equal(queueEntry(state, state.order[1]).track._id, 'manual');
  const order = state.order.slice();
  assert.deepEqual(reduce(state, { type: 'unrelated' }).order, order);
  assert.equal(new Set(order).size, 5);
  state = reduce(state, { type: 'shuffle' });
  assert.deepEqual(titles(state), ['a', 'manual', 'b', 'c', 'd']);
});

test('previous and forward follow actual listening history after shuffle and queue jumps', () => {
  let state = reduce(start(['a', 'b', 'c', 'd']), { type: 'shuffle' }, () => 0);
  const first = state.currentId;
  state = reduce(state, { type: 'next' });
  const second = state.currentId;
  state = reduce(state, { type: 'select', id: state.order.at(-1) });
  const jumped = state.currentId;
  state = reduce(state, { type: 'previous' });
  assert.equal(state.currentId, second);
  state = reduce(state, { type: 'previous' });
  assert.equal(state.currentId, first);
  state = reduce(state, { type: 'next' });
  assert.equal(state.currentId, second);
  state = reduce(state, { type: 'next' });
  assert.equal(state.currentId, jumped);
});

test('removing a repeated occurrence leaves the other occurrence and purges only removed history', () => {
  let state = start(['a', 'a', 'b']);
  const removed = state.currentId;
  state = reduce(state, { type: 'next' });
  const active = state.currentId;
  state = reduce(state, { type: 'remove', id: removed });
  assert.equal(state.currentId, active);
  assert.deepEqual(titles(state), ['a', 'b']);
  assert.deepEqual(state.history, []);
});

test('removing the active item chooses next, then previous, then an empty queue', () => {
  let state = start();
  state = reduce(state, { type: 'remove', id: state.currentId });
  assert.equal(queueEntry(state).track._id, 'b');
  state = reduce(state, { type: 'next' });
  state = reduce(state, { type: 'remove', id: state.currentId });
  assert.equal(queueEntry(state).track._id, 'b');
  state = reduce(state, { type: 'remove', id: state.currentId });
  assert.equal(state.currentId, null);
  assert.deepEqual(state.order, []);
});

test('upcoming reordering cannot move the current or already-played items', () => {
  let state = start(['a', 'b', 'c', 'd']);
  const current = state.currentId;
  state = reduce(state, { type: 'move', id: state.order[2], offset: -1 });
  assert.deepEqual(titles(state), ['a', 'c', 'b', 'd']);
  assert.equal(state.currentId, current);
  assert.equal(reduce(state, { type: 'move', id: current, offset: 1 }), state);
  assert.equal(reduce(state, { type: 'move', id: state.order[1], offset: -1 }), state);
});

test('removing current does not leave current itself at the front of back/forward history', () => {
  let state = start(['a', 'b', 'c']);
  state = reduce(reduce(state, { type: 'next' }), { type: 'next' });
  state = reduce(state, { type: 'remove', id: state.currentId });
  assert.equal(queueEntry(state).track._id, 'b');
  assert.equal(queueEntry(state, previousQueueId(state)).track._id, 'a');
  state = start(['a', 'b', 'c']);
  state = reduce(reduce(state, { type: 'next' }), { type: 'next' });
  state = reduce(state, { type: 'previous' });
  state = reduce(state, { type: 'remove', id: state.currentId });
  assert.equal(queueEntry(state).track._id, 'c');
  assert.equal(nextQueueId(state), null);
});

test('clear keeps only current music and reset drops all queue/history/preferences', () => {
  let state = reduce(start(), { type: 'next' });
  state = reduce(state, { type: 'clearUpcoming' });
  assert.deepEqual(titles(state), ['b']);
  assert.deepEqual(state.history, []);
  assert.deepEqual(reduce(state, { type: 'reset' }), emptyMusicQueue());
});

test('queue capacity and duplicate occurrence IDs fail explicitly rather than truncating', () => {
  assert.throws(() => musicEntries(Array.from({ length: MAX_QUEUE_SIZE + 1 }, () => track('a'))), /up to/);
  const items = entries(['a', 'b']); items[1].queueItemId = items[0].queueItemId;
  assert.throws(() => reduce(emptyMusicQueue(), { type: 'replace', items }), /Invalid/);
});

test('full album pagination loads tracks beyond the visible fifty in server disc/track order', async () => {
  const all = Array.from({ length: 125 }, (_, index) => ({ ...track(`song-${index}`), discNumber: index < 100 ? 1 : 2 }));
  const calls = [];
  const tracks = await loadMusicContext({ fetchPage: async page => {
    calls.push(page);
    return { ok: true, json: async () => ({ success: true, total: all.length, totalPages: 2, tracks: all.slice((page - 1) * 100, page * 100) }) };
  } });
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(tracks, all);
  assert.equal(tracks[124].discNumber, 2);
});

test('changed, partial and duplicate paginated collections cannot become a misleading partial queue', async () => {
  for (const variant of ['changed', 'duplicate', 'partial']) {
    await assert.rejects(loadMusicContext({ fetchPage: async page => ({ ok: true, json: async () => ({ success: true,
      total: page === 2 && variant === 'changed' ? 102 : 101, totalPages: 2,
      tracks: page === 1 ? Array.from({ length: 100 }, (_, i) => track(`song-${i}`)) : variant === 'partial' ? [] : [track(variant === 'duplicate' ? 'song-0' : 'last')],
    }) }) }), /changed/);
  }
});

test('cancelled context fetches cannot later supply a queue and denied/oversized collections fail visibly', async () => {
  const controller = new AbortController();
  await assert.rejects(loadMusicContext({ signal: controller.signal, fetchPage: async () => {
    controller.abort(); return { ok: true, json: async () => ({ success: true, total: 0, totalPages: 0, tracks: [] }) };
  } }), error => error.name === 'AbortError');
  await assert.rejects(loadMusicContext({ fetchPage: async () => ({ ok: false, json: async () => ({ message: 'Owner denied' }) }) }), /Owner denied/);
  await assert.rejects(loadMusicContext({ fetchPage: async () => ({ ok: true, json: async () => ({ success: true, total: 2001, totalPages: 21, tracks: [] }) }) }), /up to 2000/);
});

test('mixed queue edits maintain unique occurrence/order identity and valid history references', () => {
  let state = start(['a', 'a', 'b', 'c']), seed = 7, counter = 0;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let step = 0; step < 400; step++) {
    if (!state.items.length) state = start(['a', 'b', 'a']);
    const id = state.order[Math.floor(random() * state.order.length)];
    const actions = [{ type: 'next' }, { type: 'previous' }, { type: 'shuffle' }, { type: 'select', id },
      { type: 'move', id, offset: random() > .5 ? 1 : -1 }, { type: 'remove', id },
      { type: 'add', entry: { queueItemId: `added-${++counter}`, track: track('a') }, next: random() > .5 }];
    state = reduce(state, actions[Math.floor(random() * actions.length)], random);
    const ids = state.items.map(item => item.queueItemId);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(state.order.slice().sort(), ids.slice().sort());
    assert.equal(state.currentId === null || ids.includes(state.currentId), true);
    assert.equal([...state.history, ...state.future].every(value => ids.includes(value)), true);
  }
});
