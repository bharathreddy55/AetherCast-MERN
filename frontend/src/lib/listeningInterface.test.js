import test from 'node:test';
import assert from 'node:assert/strict';
import { musicShortcut } from './listeningInterface.js';

test('music shortcuts handle playback, seeking and mute on the non-interactive page', () => {
  for (const [key, action] of [[' ', 'toggle'], ['ArrowRight', 'forward'], ['ArrowLeft', 'back'], ['m', 'mute']]) {
    assert.equal(musicShortcut({ key }), action);
  }
  assert.equal(musicShortcut({ key: 'Escape' }), null);
});
test('search fields, editors and native controls retain their normal keyboard interactions', () => {
  for (const target of [{ isContentEditable: true }, { closest: () => ({ tagName: 'INPUT' }) }, { closest: () => ({ tagName: 'BUTTON' }) }]) {
    assert.equal(musicShortcut({ key: ' ', target }), null);
    assert.equal(musicShortcut({ key: 'ArrowRight', target }), null);
  }
});
test('music shortcuts do not intercept browser shortcuts, repeated keys or handled events', () => {
  for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'repeat', 'defaultPrevented']) assert.equal(musicShortcut({ key: 'm', [flag]: true }), null);
});
