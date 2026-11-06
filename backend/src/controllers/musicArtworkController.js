const { recoverTrackArtwork } = require('../services/recoverTrackArtwork');
const { exactBody } = require('../utils/musicLibrary');
exports.recover = async (req, res) => {
  try {
    exactBody(req.body || {}, []);
    if (Object.keys(req.query).length) return res.status(400).json({ success: false, message: 'Unsupported artwork filter.' });
    res.json({ success: true, ...await recoverTrackArtwork(req.user._id, req.params.id) });
  } catch (error) {
    res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'Unable to scan artwork right now. Your existing artwork has been kept.' });
  }
};
