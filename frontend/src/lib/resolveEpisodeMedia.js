export async function resolveEpisodeMedia(episode, { readDownload, fetchEpisode }) {
  let downloadedResponse;
  try { downloadedResponse = await readDownload(episode._id); }
  catch { /* A blocked browser cache must not prevent authorized streaming. */ }
  if (downloadedResponse) return { episode, downloadedResponse };
  const response = await fetchEpisode(episode._id);
  const data = await response.json();
  if (!response.ok || !data.success || !data.isAuthorized || !data.episode?.audioUrl) {
    throw new Error(data.message || 'This media is unavailable.');
  }
  return { episode: data.episode, downloadedResponse: null };
}
