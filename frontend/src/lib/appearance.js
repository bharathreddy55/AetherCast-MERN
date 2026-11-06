export const appearanceChoices = ['light', 'dark', 'system'];
export const validAppearance = value => appearanceChoices.includes(value) ? value : 'system';
export const resolveAppearance = (preference, systemDark = false) => preference === 'dark' || (validAppearance(preference) === 'system' && systemDark) ? 'dark' : 'light';
export function readAppearance(storage) {
  try { return validAppearance(storage?.getItem('theme')); } catch { return 'system'; }
}
export function saveAppearance(storage, preference) {
  try { storage?.setItem('theme', validAppearance(preference)); } catch { /* Appearance still works when browser storage is blocked. */ }
}
export function applyAppearance(document, theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.body?.classList.toggle('dark-theme', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#100d18' : '#fafafa');
}
