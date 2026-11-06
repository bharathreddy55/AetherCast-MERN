import React, { createContext, useContext, useState, useEffect } from 'react';
import { validAppearance, readAppearance, saveAppearance, resolveAppearance, applyAppearance } from '../lib/appearance';
const ThemeContext = createContext(null);
export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState(() => { try { return readAppearance(window.localStorage); } catch { return 'system'; } });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches || false);
  const theme = resolveAppearance(preference, systemDark);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const changed = () => setSystemDark(media?.matches || false);
    if (media?.addEventListener) media.addEventListener('change', changed); else media?.addListener?.(changed);
    const stored = event => { if (event.key === 'theme' || event.key === null) setPreference(validAppearance(event.newValue)); };
    window.addEventListener('storage', stored);
    return () => { if (media?.removeEventListener) media.removeEventListener('change', changed); else media?.removeListener?.(changed); window.removeEventListener('storage', stored); };
  }, []);
  useEffect(() => {
    applyAppearance(document, theme);
    try { saveAppearance(window.localStorage, preference); } catch { /* Storage access itself may be denied. */ }
  }, [theme, preference]);
  return <ThemeContext.Provider value={{ theme, preference, setPreference: value => setPreference(validAppearance(value)), toggleTheme: () => setPreference(theme === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
};
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
