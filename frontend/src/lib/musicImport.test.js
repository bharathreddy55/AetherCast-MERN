import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMusicFiles, uploadMusicFiles, reviewPayload } from './musicImportClient.js';

test('file selection supports album folders while reporting unsupported and oversized files', () => {
  const result = selectMusicFiles([{ name: 'one.MP3', size: 10 }, { name: 'cover.jpg', size: 10 }, { name: 'large.flac', size: 200 }], { formats: ['mp3', 'flac'], maxBytes: 100, maxPending: 20 });
  assert.equal(result.skipped, 1);
  assert.equal(result.files.length, 2);
  assert.notEqual(result.files[1].error, '');
  assert.throws(() => selectMusicFiles([{ name: 'a.wav', size: 1 }, { name: 'b.wav', size: 1 }], { formats: ['wav'], maxBytes: 100, maxPending: 1 }));
});

test('uploads files sequentially and continues after an individual failure', async () => {
  const updates = [];
  let running = 0;
  await uploadMusicFiles([{ key: 'a', file: 'a' }, { key: 'b', file: 'b' }], {
    signal: new AbortController().signal, onUpdate: (key, value) => updates.push({ key, ...value }),
    upload: async file => { running++; assert.equal(running, 1); await Promise.resolve(); running--; if (file === 'a') throw new Error('Failed'); return { import: { _id: 'job-b' } }; },
  });
  assert.equal(updates.find(value => value.key === 'a' && value.status === 'failed').error, 'Failed');
  assert.equal(updates.at(-1).status, 'uploaded');
});

test('cancelling an upload prevents later files from being sent', async () => {
  const controller = new AbortController();
  const sent = [];
  await uploadMusicFiles([{ key: 'a', file: 'a' }, { key: 'b', file: 'b' }], {
    signal: controller.signal, onUpdate() {}, upload: async file => { sent.push(file); controller.abort(); throw new Error('Aborted'); },
  });
  assert.deepEqual(sent, ['a']);
});

test('review converts user edits into the bounded server metadata contract', () => {
  const result = reviewPayload({ title: ' Song ', artists: 'AC/DC; Another artist', album: ' Album ', albumArtists: 'Band',
    genres: 'Rock, Rock, Pop', language: ' en ', discNumber: '2', trackNumber: '7', releaseDate: '', explicit: false, isCompilation: false });
  assert.deepEqual(result.artistNames, ['AC/DC', 'Another artist']);
  assert.deepEqual(result.genres, ['Rock', 'Pop']);
  assert.equal(result.releaseDate, null);
  assert.equal(result.discNumber, 2);
  assert.equal(result.ownerId, undefined);
});
