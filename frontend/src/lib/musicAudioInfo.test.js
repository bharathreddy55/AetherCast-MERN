import test from 'node:test';
import assert from 'node:assert/strict';
import { audioTechnicalLabel } from './musicAudioInfo.js';
test('quality labels report actual source technical metadata without inventing bitrate or losslessness', () => {
  assert.equal(audioTechnicalLabel(null), 'Audio details unavailable');
  assert.equal(audioTechnicalLabel({ variant: 'original', format: 'flac' }), 'Original · FLAC');
  assert.equal(audioTechnicalLabel({ variant: 'compatible', format: 'mp3', bitrate: 192000, sampleRate: 44100 }), 'Compatible copy · MP3 · 192 kbps · 44.1 kHz');
  assert.equal(audioTechnicalLabel({ format: 'wav', bitrate: NaN, sampleRate: 0 }), 'Audio · WAV');
});
