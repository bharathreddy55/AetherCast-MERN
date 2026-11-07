import test from 'node:test';
import assert from 'node:assert/strict';
import { equalizerPresets, equalizerPreset, changeEqualizerBand, readEqualizer, saveEqualizer, validEqualizer } from './equalizer.js';

test('EQ defaults to flat with missing, corrupt, oversized or blocked storage', () => {
  for (const value of [null, '', '{', 'null', '[]', '{}', ' '.repeat(257), JSON.stringify({ preset: 'unknown', gains: { low: 0, mid: 0, high: 0 } })]) {
    assert.deepEqual(readEqualizer({ getItem: () => value }), equalizerPreset('flat'));
  }
  assert.deepEqual(readEqualizer({ getItem() { throw new Error(); } }), equalizerPreset('flat'));
});
test('all named presets round trip without allowing changed gains to masquerade as a preset', () => {
  for (const name of Object.keys(equalizerPresets)) {
    const value = equalizerPreset(name), writes = [];
    assert.equal(saveEqualizer({ setItem: (...args) => writes.push(args) }, value), true);
    assert.equal(writes[0][0], 'audio.equalizer.v1');
    assert.deepEqual(readEqualizer({ getItem: () => writes[0][1] }), value);
    assert.equal(validEqualizer({ ...value, gains: { ...value.gains, low: value.gains.low + 1 } }), false);
  }
  assert.equal(equalizerPreset('__proto__'), null);
});
test('rapid band changes preserve the other bands and custom preference survives a reload', () => {
  let value = equalizerPreset('music');
  value = changeEqualizerBand(value, 'low', -10);
  value = changeEqualizerBand(value, 'high', 10);
  assert.deepEqual(value, { preset: 'custom', gains: { low: -10, mid: -1, high: 10 } });
  assert.deepEqual(readEqualizer({ getItem: () => JSON.stringify(value) }), value);
});
test('nonfinite/out-of-range gains, unknown bands and malformed stored shapes fail closed', () => {
  for (const gain of [NaN, Infinity, -Infinity, -11, 11, '5', null, undefined]) {
    assert.equal(changeEqualizerBand(equalizerPreset('flat'), 'low', gain), null);
    assert.equal(validEqualizer({ preset: 'custom', gains: { low: gain, mid: 0, high: 0 } }), false);
  }
  assert.equal(changeEqualizerBand(equalizerPreset('flat'), '__proto__', 1), null);
  assert.equal(validEqualizer({ preset: 'custom', gains: { low: 0, mid: 0, high: 0, token: 'x' } }), false);
  assert.equal(validEqualizer({ ...equalizerPreset('flat'), token: 'x' }), false);
});
test('reset is a fresh flat setting, without mutating presets or retaining custom bands', () => {
  const old = equalizerPreset('bass-boost'); old.gains.low = -10;
  assert.equal(equalizerPreset('bass-boost').gains.low, 6);
  const reset = equalizerPreset('flat');
  assert.deepEqual(readEqualizer({ getItem: () => JSON.stringify(reset) }), { preset: 'flat', gains: { low: 0, mid: 0, high: 0 } });
});
test('blocked persistence does not throw or write invalid/private fields', () => {
  assert.equal(saveEqualizer({ setItem() { throw new Error(); } }, equalizerPreset('flat')), false);
  const writes = [];
  assert.equal(saveEqualizer({ setItem: value => writes.push(value) }, { ...equalizerPreset('flat'), token: 'private' }), false);
  assert.deepEqual(writes, []);
});
