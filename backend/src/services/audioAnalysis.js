const { Worker } = require('worker_threads');
const path = require('path');
function analyzeAudio(bytes, filename, mimeType) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(__dirname, '../workers/audioMetadataWorker.js'), {
      workerData: { bytes, filename, mimeType }, env: {}, resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error('Audio analysis timed out.')); }, 20000);
    const finish = () => { clearTimeout(timer); void worker.terminate(); };
    worker.once('message', result => { finish(); if (result.success) resolve(result); else reject(new Error(result.message)); });
    worker.once('error', () => { finish(); reject(new Error('Audio analysis could not be completed.')); });
    worker.once('exit', code => { if (code !== 0) { clearTimeout(timer); reject(new Error('Audio analysis stopped before completion.')); } });
  });
}
module.exports = { analyzeAudio };
