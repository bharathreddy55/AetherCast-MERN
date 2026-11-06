const Track = require('../models/Track');
const TrackLyrics = require('../models/TrackLyrics');
const { active, exactBody, version, failure } = require('../utils/musicLibrary');
const { lyricsInput, lyricsDto } = require('../utils/musicLyrics');
exports.lyrics = async (req, res) => {
  try {
    const filter = { ownerId: req.user._id, trackId: req.params.id };
    if (!await Track.exists({ ...active(req.user._id), _id: req.params.id })) throw failure(404, 'This song is unavailable');
    if (req.method === 'GET') {
      if (Object.keys(req.query).length) throw failure(400, 'Unsupported lyrics filter');
      return res.json({ success: true, lyrics: lyricsDto(await TrackLyrics.findOne(filter).lean()) });
    }
    let input;
    if (req.method === 'DELETE') {
      exactBody(req.body, ['version']); version(req.body.version);
      input = { content: '', format: 'plain', offsetMs: 0, source: '' };
    } else input = lyricsInput(req.body);
    let record;
    if (req.body.version === 0) record = await TrackLyrics.create({ ...filter, ...input, version: 1 });
    else record = await TrackLyrics.findOneAndUpdate({ ...filter, version: req.body.version }, { $set: input, $inc: { version: 1 } }, { new: true, runValidators: true });
    if (!record) throw failure(409, 'Lyrics changed on another device. Reload before saving.');
    res.json({ success: true, lyrics: lyricsDto(record) });
  } catch (error) {
    const status = error.status || (error.code === 11000 ? 409 : 500);
    res.status(status).json({ success: false, message: error.status ? error.message : status === 409 ? 'Lyrics changed on another device. Reload before saving.' : 'Unable to load or save lyrics.' });
  }
};
