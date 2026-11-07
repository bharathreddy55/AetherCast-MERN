const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

// Bound transfer inactivity, not song length. Pipeline retains backpressure and
// aborts/cancels both ends on timeout, disconnect or stream failure.
async function transferPrivateMedia(body, destination, controller, { idleMs = 30000 } = {}) {
  let timer;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), idleMs);
    timer.unref?.();
  };
  const progress = new Transform({ transform(chunk, encoding, callback) {
    if (chunk.length) refresh();
    callback(null, chunk);
  } });
  refresh();
  try {
    await pipeline(Readable.fromWeb(body), progress, destination, { signal: controller.signal });
  } finally { clearTimeout(timer); }
}

module.exports = { transferPrivateMedia };
