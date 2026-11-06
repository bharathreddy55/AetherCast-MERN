import test from 'node:test';
import assert from 'node:assert/strict';
import { activeLyricTime, lyricSeekPosition, readLyricFile } from './musicLyrics.js';
test('lyrics follow forward/backward seeks, offsets and simultaneous lines', () => {
  const lines = [{ at: 1 }, { at: 5 }, { at: 5 }, { at: 20 }];
  assert.equal(activeLyricTime(lines, 0, 0), null);
  assert.equal(activeLyricTime(lines, 5, 0), 5);
  assert.equal(activeLyricTime(lines, 5, 1000), 1);
  assert.equal(activeLyricTime(lines, 4, -1000), 5);
  assert.equal(activeLyricTime(lines, 25, 0), 20);
  assert.equal(activeLyricTime(lines, 2, 0), 1);
  assert.equal(activeLyricTime([], 5, 0), null);
});
test('lyric-line seeks apply the same offset and clamp to the playable duration', () => {
  assert.equal(lyricSeekPosition(5, 1000, 30), 6);
  assert.equal(lyricSeekPosition(1, -5000, 30), 0);
  assert.equal(lyricSeekPosition(100, 5000, 30), 30);
  assert.equal(lyricSeekPosition(5, 0, 0), 0);
});
test('file drafts are bounded, UTF-8 and explicit plain/LRC without uploading automatically', async () => {
  assert.deepEqual(await readLyricFile({ name: 'song.LRC', size: 40, text: async () => '[00:01]Owner line' }), { content: '[00:01]Owner line', format: 'lrc' });
  assert.equal((await readLyricFile({ name: 'song.txt', size: 4, text: async () => 'text' })).format, 'plain');
  for (const file of [{ name: 'a.mp3', size: 4 }, { name: 'a.lrc', size: 100001 }, { name: 'a.txt', size: 5, text: async () => '\uFFFD' }, { name: 'a.txt', size: 99999, text: async () => 'a'.repeat(50001) }]) await assert.rejects(() => readLyricFile(file));
});
