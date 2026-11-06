const records = require('../data/verifiedSongArtwork.json');
// Punctuation/case normalization only: never remove remix, language or version names.
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
function verifiedSongArtwork(track) {
  const artists = (track.artistCredits || []).filter(credit => !credit.role || credit.role === 'primary').map(credit => normalize(credit.artistId?.name));
  const title = normalize(track.title), album = normalize(track.albumId?.title), language = normalize(track.language);
  const record = records.find(item => item.titles.some(value => normalize(value) === title)
    && item.artists.some(value => artists.includes(normalize(value)))
    && (!language || !item.languages || item.languages.some(value => normalize(value) === language))
    && (!album || [...item.albums, ...item.titles, ...item.titles.map(value => `${value} - Single`)].some(value => normalize(value) === album)));
  if (!record) return null;
  return { image: `https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02${record.image}`, source: { kind: 'verified-release', label: 'Release artwork on Spotify', url: `https://open.spotify.com/${record.source}` } };
}
module.exports = { verifiedSongArtwork };
