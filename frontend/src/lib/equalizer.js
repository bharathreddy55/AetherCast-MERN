export const equalizerPresets = Object.freeze({
  flat: Object.freeze({ low: 0, mid: 0, high: 0 }),
  'bass-boost': Object.freeze({ low: 6, mid: 0, high: -2 }),
  'voice-clarity': Object.freeze({ low: -4, mid: 4, high: 3 }),
  'classic-podcast': Object.freeze({ low: 2, mid: 3, high: 1 }),
  music: Object.freeze({ low: 4, mid: -1, high: 4 }),
});
const bands = ['low', 'mid', 'high'];
const key = 'audio.equalizer.v1';
const validGains = gains => gains && typeof gains === 'object' && Object.keys(gains).length === 3
  && bands.every(band => Number.isFinite(gains[band]) && gains[band] >= -10 && gains[band] <= 10);
export const equalizerPreset = preset => Object.hasOwn(equalizerPresets, preset)
  ? { preset, gains: { ...equalizerPresets[preset] } } : null;
export function validEqualizer(value) {
  return !!value && typeof value === 'object' && Object.keys(value).length === 2 && validGains(value.gains)
    && (value.preset === 'custom' || (Object.hasOwn(equalizerPresets, value.preset)
      && bands.every(band => value.gains[band] === equalizerPresets[value.preset][band])));
}
export function readEqualizer(storage) {
  try {
    const raw = storage?.getItem(key);
    if (typeof raw === 'string' && raw.length <= 256) {
      const value = JSON.parse(raw);
      if (validEqualizer(value)) return { preset: value.preset, gains: { ...value.gains } };
    }
  } catch { /* Corrupt or unavailable browser storage must not block playback. */ }
  return equalizerPreset('flat');
}
export function saveEqualizer(storage, value) {
  if (!validEqualizer(value)) return false;
  try { storage?.setItem(key, JSON.stringify({ preset: value.preset, gains: { ...value.gains } })); return !!storage; }
  catch { return false; }
}
export function changeEqualizerBand(value, band, gain) {
  if (!validEqualizer(value) || !bands.includes(band) || !Number.isFinite(gain) || gain < -10 || gain > 10) return null;
  return { preset: 'custom', gains: { ...value.gains, [band]: gain } };
}
