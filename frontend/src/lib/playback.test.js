import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEpisodeMedia } from './resolveEpisodeMedia.js';

const oldEpisode = { _id: 'track', audioUrl: '/media/expired' };
test('resolves a fresh authorized URL instead of reusing an expired URL', async () => {
  const result = await resolveEpisodeMedia(oldEpisode, {
    readDownload: async () => null,
    fetchEpisode: async () => Response.json({ success: true, isAuthorized: true, episode: { ...oldEpisode, audioUrl: '/media/fresh' } }),
  });
  assert.equal(result.episode.audioUrl, '/media/fresh');
});

test('plays a verified account download without requesting an online media link', async () => {
  const cached = new Response('cached audio');
  const result = await resolveEpisodeMedia(oldEpisode, {
    readDownload: async () => cached,
    fetchEpisode: async () => assert.fail('Offline playback must not require an online API call'),
  });
  assert.equal(result.downloadedResponse, cached);
});

test('never falls back to the old URL after a denied or failed media lookup', async () => {
  for (const response of [
    Response.json({ success: false, message: 'Private library' }, { status: 403 }),
    Response.json({ success: true, isAuthorized: false, episode: oldEpisode }),
    Response.json({ success: true, isAuthorized: true, episode: { _id: 'track' } }),
  ]) {
    await assert.rejects(resolveEpisodeMedia(oldEpisode, { readDownload: async () => null, fetchEpisode: async () => response }));
  }
  await assert.rejects(resolveEpisodeMedia(oldEpisode, {
    readDownload: async () => null, fetchEpisode: async () => { throw new Error('Network unavailable'); },
  }), /Network unavailable/);
});

test('still streams if browser cache access is blocked', async () => {
  const result = await resolveEpisodeMedia(oldEpisode, {
    readDownload: async () => { throw new Error('Cache blocked'); },
    fetchEpisode: async () => Response.json({ success: true, isAuthorized: true, episode: { ...oldEpisode, audioUrl: '/media/fresh' } }),
  });
  assert.equal(result.episode.audioUrl, '/media/fresh');
});
