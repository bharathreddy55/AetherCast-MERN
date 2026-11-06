import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
export default function AppearanceToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return <button type="button" className="aether-icon aether-theme-toggle" onClick={toggleTheme} aria-label={dark ? 'Use light theme' : 'Use dark theme'} aria-pressed={dark} title={dark ? 'Switch to light theme' : 'Switch to dark theme'}>{dark ? <Sun size={20} /> : <Moon size={20} />}</button>;
}
