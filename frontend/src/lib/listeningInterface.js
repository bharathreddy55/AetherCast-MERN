export function artworkHue(seed = '') {
  return [...String(seed)].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) % 360, 210);
}
export function musicShortcut(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return null;
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.('input, textarea, select, button, a, [role="button"], [contenteditable="true"]')) return null;
  return ({ ' ': 'toggle', ArrowRight: 'forward', ArrowLeft: 'back', m: 'mute', M: 'mute' })[event.key] || null;
}
