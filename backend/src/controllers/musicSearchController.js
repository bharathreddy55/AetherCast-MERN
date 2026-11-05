const Track = require('../models/Track');
const Artist = require('../models/Artist');
const Album = require('../models/Album');
const MusicPlaylist = require('../models/MusicPlaylist');
const { searchQuery } = require('../utils/musicSearch');
const { population, playlistDto } = require('../utils/musicLibrary');
const { musicDto } = require('../utils/musicCatalog');
const models = { tracks: Track, artists: Artist, albums: Album, playlists: MusicPlaylist };

exports.search = async (req, res) => {
  try {
    const options = searchQuery(req.query, req.user._id);
    const entries = await Promise.all(options.groups.map(async resource => {
      const { filter, sort, skip } = options.forResource(resource);
      let records = models[resource].find(filter).sort(sort).skip(skip).limit(options.limit).maxTimeMS(2000);
      records = resource === 'playlists' ? records.select('name description version updatedAt items._id') : records.populate(population(resource, req.user._id));
      const [rows, total] = await Promise.all([records.lean(), models[resource].countDocuments(filter).maxTimeMS(2000)]);
      return [resource, { items: rows.map(row => resource === 'playlists' ? playlistDto(row) : musicDto(resource, row)),
        total, page: options.page, limit: options.limit, totalPages: Math.ceil(total / options.limit) }];
    }));
    res.json({ success: true, q: options.q, groups: Object.fromEntries(entries) });
  } catch (error) {
    const timeout = error.code === 50 || error.codeName === 'MaxTimeMSExpired';
    res.status(error.status || (timeout ? 503 : 500)).json({ success: false,
      message: error.status ? error.message : timeout ? 'Search took too long. Try a more specific name.' : 'Unable to search your music. Try again.' });
  }
};
