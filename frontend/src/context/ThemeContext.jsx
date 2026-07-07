import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

const COLOR_THEMES = {
  purple: {
    primary: '#9333ea',
    primaryHover: '#a855f7',
    secondary: '#06b6d4',
    gradient: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
    borderHover: 'rgba(147, 51, 234, 0.4)',
  },
  cyan: {
    primary: '#0891b2',
    primaryHover: '#06b6d4',
    secondary: '#9333ea',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #a855f7 100%)',
    borderHover: 'rgba(6, 182, 212, 0.4)',
  },
  emerald: {
    primary: '#059669',
    primaryHover: '#10b981',
    secondary: '#06b6d4',
    gradient: 'linear-gradient(135deg, #059669 0%, #06b6d4 100%)',
    borderHover: 'rgba(16, 185, 129, 0.4)',
  },
  orange: {
    primary: '#ea580c',
    primaryHover: '#f97316',
    secondary: '#e11d48',
    gradient: 'linear-gradient(135deg, #ea580c 0%, #e11d48 100%)',
    borderHover: 'rgba(249, 115, 22, 0.4)',
  },
};

export const ThemeProvider = ({ children }) => {
  const [accent, setAccent] = useState(localStorage.getItem('theme-accent') || 'purple');
  const [opacity, setOpacity] = useState(Number(localStorage.getItem('theme-opacity') || '0.6'));
  const [blur, setBlur] = useState(Number(localStorage.getItem('theme-blur') || '12'));

  const applyTheme = () => {
    const root = document.documentElement;
    const themeConfig = COLOR_THEMES[accent] || COLOR_THEMES.purple;

    // Apply color variables
    root.style.setProperty('--color-primary', themeConfig.primary);
    root.style.setProperty('--color-primary-hover', themeConfig.primaryHover);
    root.style.setProperty('--color-secondary', themeConfig.secondary);
    root.style.setProperty('--grad-accent', themeConfig.gradient);
    root.style.setProperty('--border-hover', themeConfig.borderHover);

    // Apply glassmorphism variables
    root.style.setProperty('--glass-bg', `rgba(15, 10, 36, ${opacity})`);
    root.style.setProperty('--glass-blur', `${blur}px`);
  };

  useEffect(() => {
    applyTheme();
    // Save preferences
    localStorage.setItem('theme-accent', accent);
    localStorage.setItem('theme-opacity', opacity.toString());
    localStorage.setItem('theme-blur', blur.toString());
  }, [accent, opacity, blur]);

  return (
    <ThemeContext.Provider value={{ accent, setAccent, opacity, setOpacity, blur, setBlur }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
