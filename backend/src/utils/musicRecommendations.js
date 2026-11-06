const key = value => String(value?._id || value);
function rankMusic({ tracks, likes, events, exclusions, now = Date.now(), limit = 30 }) {
  const liked = new Set(likes.map(value => key(value.trackId)));
  const blockedTracks = new Set(exclusions.filter(value => value.kind === 'Track').map(value => key(value.referenceId)));
  const blockedArtists = new Set(exclusions.filter(value => value.kind === 'Artist').map(value => key(value.referenceId)));
  const available = tracks.filter(track => !blockedTracks.has(key(track)) && !(track.artistCredits || []).some(credit => blockedArtists.has(key(credit.artistId))));
  const catalog = new Map(available.map(track => [key(track), track])), stats = new Map(), artists = new Set(), genres = new Set();
  const seed = track => { (track.artistCredits || []).forEach(credit => artists.add(key(credit.artistId))); (track.genres || []).forEach(genre => genres.add(genre.toLowerCase())); };
  available.filter(track => liked.has(key(track))).forEach(seed);
  for (const event of events) {
    const track = catalog.get(key(event.trackId)); if (!track) continue;
    const stat = stats.get(key(track)) || { meaningful: 0, skips: 0, recent: false };
    const heard = Math.max(0, Math.min(Number(event.playedSeconds) || 0, track.duration));
    if (heard >= Math.min(30, track.duration * .5)) { ++stat.meaningful; seed(track); }
    else if (event.outcome === 'skipped' && heard < Math.min(10, track.duration * .2)) ++stat.skips;
    if (now - new Date(event.startedAt).getTime() < 86400000) stat.recent = true;
    stats.set(key(track), stat);
  }
  const ranked = available.map(track => {
    const stat = stats.get(key(track)), reasons = []; let score = 0;
    if (liked.has(key(track))) { score += 8; reasons.push('Liked by you'); }
    if (stat?.meaningful) { score += Math.min(8, stat.meaningful * 2); reasons.push('You spent time listening to this song'); }
    if ((track.artistCredits || []).some(credit => artists.has(key(credit.artistId)))) { score += 3; reasons.push('Shares artists with your likes or listening'); }
    if ((track.genres || []).some(genre => genres.has(genre.toLowerCase()))) { score += 2; reasons.push('Matches genres in your likes or listening'); }
    if (!stat) { score += 2; reasons.push('No plays in the sampled recent history'); }
    if (now - new Date(track.createdAt).getTime() < 30 * 86400000) { score += 1; reasons.push('Added in the last 30 days'); }
    if (stat?.recent) score -= 3;
    score -= Math.min(6, (stat?.skips || 0) * 2);
    return { track, score, reasons: reasons.length ? reasons : ['From your available library'] };
  }).sort((a, b) => b.score - a.score || key(a.track).localeCompare(key(b.track)));
  // Greedy diversity penalty changes selection order, not the underlying evidence score.
  const result = [], selectedArtists = new Map();
  while (ranked.length && result.length < limit) {
    const penalty = row => (row.track.artistCredits || []).reduce((sum, credit) => sum + (selectedArtists.get(key(credit.artistId)) || 0) * 3, 0);
    let best = 0;
    for (let index = 1; index < ranked.length; index++) if (ranked[index].score - penalty(ranked[index]) > ranked[best].score - penalty(ranked[best])) best = index;
    const [row] = ranked.splice(best, 1); result.push(row);
    (row.track.artistCredits || []).forEach(credit => selectedArtists.set(key(credit.artistId), (selectedArtists.get(key(credit.artistId)) || 0) + 1));
  }
  return result;
}
module.exports = { rankMusic };
