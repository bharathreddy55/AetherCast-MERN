import test from 'node:test';
import assert from 'node:assert/strict';
import { audioTechnicalLabel, loudnessLabel } from './musicAudioInfo.js';
test('quality labels report actual source technical metadata without inventing bitrate or losslessness', () => {
  assert.equal(audioTechnicalLabel(null), 'Audio details unavailable');
  assert.equal(audioTechnicalLabel({ variant: 'original', format: 'flac' }), 'Original · FLAC');
  assert.equal(audioTechnicalLabel({ variant: 'compatible', format: 'mp3', bitrate: 192000, sampleRate: 44100 }), 'Compatible copy · MP3 · 192 kbps · 44.1 kHz');
  assert.equal(audioTechnicalLabel({ format: 'wav', bitrate: NaN, sampleRate: 0 }), 'Audio · WAV');
});

const loudness = { mode: 'linear', targetIntegratedLufs: -14, maxTruePeakDbtp: -1, inputIntegratedLufs: -8, outputIntegratedLufs: -14.2, outputTruePeakDbtp: -9.1, appliedGainDb: -6 };
test('normalization labels use actual encoded measurements and distinguish normalized MP3 from original', () => {
  assert.equal(loudnessLabel(loudness), '-8.0 → -14.2 LUFS · peak -9.1 dBTP · gain -6.0 dB');
  assert.equal(audioTechnicalLabel({ variant: 'normalized', format: 'mp3', bitrate: 192000, loudness }), 'Normalized copy · MP3 · 192 kbps · -14.2 LUFS');
  assert.ok(loudnessLabel({ ...loudness, appliedGainDb: 6 }).includes('+6.0 dB'));
});
test('missing, nonfinite, out-of-range and unsafe peak measurements never get invented labels', () => {
  for (const value of [null, {}, { ...loudness, outputTruePeakDbtp: null }, { ...loudness, outputIntegratedLufs: Infinity },
    { ...loudness, outputTruePeakDbtp: 0 }, { ...loudness, appliedGainDb: 20 }, { ...loudness, targetIntegratedLufs: -5 }]) assert.equal(loudnessLabel(value), '');
  assert.equal(audioTechnicalLabel({ variant: 'normalized', format: 'mp3' }), 'Normalized copy · MP3');
});
