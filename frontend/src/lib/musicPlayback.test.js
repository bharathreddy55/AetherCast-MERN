import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlayerMedia, sameMedia, adjacentMedia, episodeProgressSnapshot, artistNames, formatMusicTime, initialPlaybackPosition } from './musicPlayback.js';

const track = { _id: 'song-1', kind: 'track', title: 'Original title', audioUrl: 'expired' };
const forbidden = () => { throw new Error('Podcast API/cache must not be used for music'); };
test('music always resolves fresh private playback without using episode APIs or downloads', async () => {
  const calls = [];
  const result = await resolvePlayerMedia(track, { readDownload: forbidden, fetchEpisode: forbidden,
    fetchTrack: async id => { calls.push(id); return { ok: true, json: async () => ({ success: true, track: { _id: id, title: 'Updated title', audioUrl: 'fresh' } }) }; } });
  assert.deepEqual(calls, ['song-1']);
  assert.equal(result.episode.kind, 'track');
  assert.equal(result.episode.title, 'Updated title');
  assert.equal(result.episode.audioUrl, 'fresh');
  assert.equal(result.downloadedResponse, null);
});
test('denied, deleted, mismatched and unavailable songs never fall back to cached URLs', async () => {
  for (const [ok, data] of [[false, { message: 'Denied' }], [true, { success: false }],
    [true, { success: true, track: { _id: 'different', audioUrl: 'wrong' } }], [true, { success: true, track: { _id: track._id } }]]) {
    await assert.rejects(resolvePlayerMedia(track, { fetchTrack: async () => ({ ok, json: async () => data }), readDownload: forbidden, fetchEpisode: forbidden }));
  }
});
test('podcast playback still supports authorized detail lookup and owner downloads', async () => {
  const episode = { _id: 'episode-1' };
  const response = new Response('cached audio');
  assert.equal((await resolvePlayerMedia(episode, { readDownload: async () => response, fetchEpisode: forbidden, fetchTrack: forbidden })).downloadedResponse, response);
  const resolved = await resolvePlayerMedia(episode, { readDownload: async () => null, fetchTrack: forbidden,
    fetchEpisode: async () => ({ ok: true, json: async () => ({ success: true, isAuthorized: true, episode: { ...episode, audioUrl: 'authorized' } }) }) });
  assert.equal(resolved.episode.audioUrl, 'authorized');
});
test('typed queue identity prevents podcast/song ID collisions and respects queue boundaries', () => {
  const episode = { _id: track._id };
  const second = { _id: 'song-2', kind: 'track' };
  const queue = [track, second];
  assert.equal(sameMedia(track, episode), false);
  assert.equal(adjacentMedia(queue, track, 1), second);
  assert.equal(adjacentMedia(queue, track, -1), null);
  assert.equal(adjacentMedia(queue, second, 1), null);
  assert.equal(adjacentMedia(queue, episode, 1), null);
});
test('music, stale owners and unattached audio never produce podcast progress writes', () => {
  const auth = { ownerId: 'owner', token: 'token' };
  const audio = { currentTime: 15, duration: 100 };
  assert.equal(episodeProgressSnapshot({ ready: true, ownerId: 'owner', episode: track }, auth, audio), null);
  assert.equal(episodeProgressSnapshot({ ready: true, ownerId: 'other', episode: { _id: 'episode' } }, auth, audio), null);
  assert.equal(episodeProgressSnapshot({ ready: false, ownerId: 'owner', episode: { _id: 'episode' } }, auth, audio), null);
  assert.deepEqual(episodeProgressSnapshot({ ready: true, ownerId: 'owner', episode: { _id: 'episode' } }, auth, audio), { ...auth, episodeId: 'episode', position: 15, duration: 100 });
});
test('music labels tolerate missing credits and invalid durations', () => {
  assert.equal(artistNames({}), 'Unknown artist');
  assert.equal(artistNames({ artistCredits: [{ artist: { name: 'One' } }, { artist: null }, { artist: { name: 'Two' } }] }), 'One, Two');
  assert.equal(formatMusicTime(185.9), '3:05');
  assert.equal(formatMusicTime(Infinity), '0:00');
  assert.equal(formatMusicTime(-1), '0:00');
});
test('selecting another song starts at zero while refreshing the current song retains position', () => {
  const audio = { currentTime: 42, ended: false };
  assert.equal(initialPlaybackPosition(track, { kind: 'track', _id: 'other' }, audio), 0);
  assert.equal(initialPlaybackPosition(track, { _id: track._id }, audio), 0);
  assert.equal(initialPlaybackPosition(track, track, audio), 42);
  assert.equal(initialPlaybackPosition(track, track, { ...audio, ended: true }), 0);
  assert.equal(initialPlaybackPosition(track, track, { currentTime: NaN }), 0);
});
