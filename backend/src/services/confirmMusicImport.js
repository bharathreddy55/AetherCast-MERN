const mongoose = require('mongoose');
const crypto = require('crypto');
const MusicImport = require('../models/MusicImport');
const MediaAsset = require('../models/MediaAsset');
const Artist = require('../models/Artist');
const Album = require('../models/Album');
const Track = require('../models/Track');
const { reviewInput } = require('../utils/musicImportMetadata');
const failure = (status, message) => Object.assign(new Error(message), { status });
const normalized = value => value.normalize('NFKC').trim().toLowerCase();
const keyFor = values => crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex');
const exactName = name => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

async function confirmMusicImport(ownerId, jobId, body) {
  const metadata = reviewInput(body);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const job = await MusicImport.findOne({ _id: jobId, ownerId }).session(session);
      if (!job) throw failure(404, 'Music import not found.');
      if (job.status === 'completed') { result = { trackId: job.trackId, duplicate: true }; return; }
      if (job.status !== 'review') throw failure(409, 'Wait for audio processing before confirming this import.');
      const asset = await MediaAsset.findOne({ _id: job.assetId, ownerId, kind: 'audio', status: 'ready' }).session(session);
      if (!asset) throw failure(409, 'The original audio is not ready. Retry processing this import.');
      const existing = await Track.findOne({ ownerId, audioAssetId: asset._id, deletedAt: null }).session(session);
      if (existing) {
        job.status = 'completed'; job.trackId = existing._id;
        await job.save({ session });
        result = { trackId: existing._id, duplicate: true }; return;
      }
      const resolveArtist = async name => {
        const importKey = keyFor([normalized(name)]);
        const previous = await Artist.findOne({ ownerId, deletedAt: null, $or: [{ importKey }, { name: exactName(name) }] }).session(session);
        if (previous) return previous._id;
        const [artist] = await Artist.create([{ name, ownerId, deletedAt: null, importKey }], { session });
        return artist._id;
      };
      const artistIds = [];
      for (const name of metadata.artistNames) artistIds.push(await resolveArtist(name));
      let albumId = null;
      if (metadata.albumTitle) {
        const albumArtists = [];
        for (const name of metadata.albumArtistNames) albumArtists.push(await resolveArtist(name));
        const uniqueAlbumArtists = [...new Set(albumArtists.map(String))];
        const key = keyFor([normalized(metadata.albumTitle), uniqueAlbumArtists.slice().sort(), metadata.releaseDate?.slice(0, 4) || '', metadata.isCompilation]);
        let releaseDate = null;
        if (metadata.releaseDate) {
          const start = new Date(`${metadata.releaseDate.slice(0, 4)}-01-01`);
          const end = new Date(start); end.setUTCFullYear(start.getUTCFullYear() + 1);
          releaseDate = { $gte: start, $lt: end };
        }
        const previous = await Album.findOne({ ownerId, deletedAt: null, $or: [{ importKey: key }, { title: exactName(metadata.albumTitle), releaseDate,
          artistIds: uniqueAlbumArtists.length ? { $all: uniqueAlbumArtists, $size: uniqueAlbumArtists.length } : { $size: 0 },
          isCompilation: metadata.isCompilation }] }).session(session);
        const album = previous || (await Album.create([{ ownerId, deletedAt: null, importKey: key, title: metadata.albumTitle, artistIds: uniqueAlbumArtists,
            isCompilation: metadata.isCompilation, releaseDate: metadata.releaseDate, coverAssetId: job.coverAssetId,
            genres: metadata.genres, language: metadata.language }], { session }))[0];
        albumId = album._id;
      }
      const [track] = await Track.create([{ ownerId, title: metadata.title,
        artistCredits: [...new Set(artistIds.map(String))].map(artistId => ({ artistId, role: 'primary' })),
        albumId, audioAssetId: asset._id, coverAssetId: job.coverAssetId, duration: asset.duration,
        discNumber: metadata.discNumber, trackNumber: metadata.trackNumber, releaseDate: metadata.releaseDate,
        genres: metadata.genres, language: metadata.language, explicit: metadata.explicit }], { session });
      job.status = 'completed'; job.trackId = track._id; job.metadata = metadata;
      await job.save({ session });
      result = { trackId: track._id, duplicate: false };
    });
    return result;
  } finally { await session.endSession(); }
}
module.exports = { confirmMusicImport };
