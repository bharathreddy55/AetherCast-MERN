const { parentPort, workerData } = require('worker_threads');
const { extractReview } = require('../utils/musicImportMetadata');
const { selectEmbeddedCover } = require('../utils/embeddedArtwork');
(async () => {
  try {
    const { parseBuffer, TrackType } = await import('music-metadata');
    const bytes = Buffer.from(workerData.bytes);
    const result = await parseBuffer(bytes, { mimeType: workerData.mimeType, size: bytes.length }, { duration: true });
    if (!Number.isFinite(result.format.duration) || result.format.duration <= 0 ||
        !Number.isFinite(result.format.numberOfChannels) || result.format.numberOfChannels < 1 ||
        result.format.trackInfo?.some(track => track.video || (TrackType && track.type === TrackType.video))) throw new Error('No supported audio-only stream');
    const picture = selectEmbeddedCover(result.common.picture);
    parentPort.postMessage({ success: true, metadata: extractReview(result.common, workerData.filename),
      technical: { duration: result.format.duration, codec: (result.format.codec || '').slice(0, 80), bitrate: result.format.bitrate, sampleRate: result.format.sampleRate },
      picture });
  } catch { parentPort.postMessage({ success: false, message: 'This file could not be read as supported audio. Try a different copy.' }); }
})();
