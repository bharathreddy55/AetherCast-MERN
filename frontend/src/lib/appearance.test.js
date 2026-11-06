import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { validAppearance, readAppearance, saveAppearance, resolveAppearance, applyAppearance } from './appearance.js';
test('appearance preserves legacy dark/light preferences and treats missing/invalid values as system', () => {
  for (const value of ['light', 'dark', 'system']) assert.equal(readAppearance({ getItem: () => value }), value);
  for (const value of [null, undefined, 'purple', '<script>', {}]) assert.equal(validAppearance(value), 'system');
  assert.equal(readAppearance({ getItem: () => { throw Error('denied'); } }), 'system');
  assert.equal(resolveAppearance('system', true), 'dark'); assert.equal(resolveAppearance('system', false), 'light');
  assert.equal(resolveAppearance('light', true), 'light'); assert.equal(resolveAppearance('dark', false), 'dark');
});
test('appearance writes only the display preference and tolerates blocked storage', () => {
  const writes = []; saveAppearance({ setItem: (...args) => writes.push(args) }, 'dark');
  assert.deepEqual(writes, [['theme', 'dark']]);
  assert.doesNotThrow(() => saveAppearance({ setItem: () => { throw Error('denied'); } }, 'light'));
});
const documentStub = () => ({ documentElement: { dataset: {}, style: {} }, body: { classList: { toggle() {} } }, meta: {}, querySelector() { return { setAttribute: (key, value) => { this.meta[key] = value; } }; } });
test('switching appearance updates root mode, native control scheme, legacy body class and browser chrome', () => {
  const document = documentStub(), calls = []; document.body.classList.toggle = (...args) => calls.push(args);
  applyAppearance(document, 'dark'); assert.equal(document.documentElement.dataset.theme, 'dark'); assert.equal(document.documentElement.style.colorScheme, 'dark'); assert.equal(document.meta.content, '#100d18');
  applyAppearance(document, 'light'); assert.equal(document.meta.content, '#fafafa'); assert.deepEqual(calls, [['dark-theme', true], ['dark-theme', false]]);
});
test('before-paint initialization agrees with saved/system choices without accessing auth or private data', () => {
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const preference of ['dark', 'light', 'system', null, 'bad']) for (const systemDark of [true, false]) {
    const document = documentStub(); document.querySelector = () => (document.meta);
    vm.runInNewContext(script, { document, localStorage: { getItem: key => { assert.equal(key, 'theme'); return preference; } }, window: { matchMedia: () => ({ matches: systemDark }) } });
    assert.equal(document.documentElement.dataset.theme, resolveAppearance(validAppearance(preference), systemDark));
  }
});
test('reference palettes keep normal body/secondary/muted text and primary buttons above 4.5:1 contrast', () => {
  const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const luminance = hex => {
    const channels = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const contrast = (a, b) => { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05); };
  const blocks = [css.match(/:root \{([\s\S]*?)\}/)[1], css.match(/:root\[data-theme='dark'\] \{([\s\S]*?)\}/)[1]];
  for (const block of blocks) {
    const tokens = Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})(?![0-9a-f])/g)].map(match => [match[1], match[2]]));
    for (const text of ['--text-primary', '--text-secondary', '--text-muted']) for (const surface of ['--bg-main', '--bg-card']) assert.ok(contrast(tokens[text], tokens[surface]) >= 4.5, `${text} on ${surface}`);
    assert.ok(contrast(tokens['--on-primary'], tokens['--color-primary']) >= 4.5);
  }
});
