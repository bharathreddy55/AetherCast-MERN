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
  rose: {
    primary: '#db2777',
    primaryHover: '#f43f5e',
    secondary: '#2563eb',
    gradient: 'linear-gradient(135deg, #db2777 0%, #f43f5e 100%)',
    borderHover: 'rgba(219, 39, 119, 0.4)',
  },
  blue: {
    primary: '#2563eb',
    primaryHover: '#3b82f6',
    secondary: '#db2777',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
    borderHover: 'rgba(37, 99, 235, 0.4)',
  },
  amber: {
    primary: '#d97706',
    primaryHover: '#f59e0b',
    secondary: '#ea580c',
    gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    borderHover: 'rgba(217, 119, 6, 0.4)',
  },
  teal: {
    primary: '#0d9488',
    primaryHover: '#14b8a6',
    secondary: '#4f46e5',
    gradient: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
    borderHover: 'rgba(13, 148, 136, 0.4)',
  },
  red: {
    primary: '#dc2626',
    primaryHover: '#ef4444',
    secondary: '#db2777',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
    borderHover: 'rgba(220, 38, 38, 0.4)',
  },
  lime: {
    primary: '#65a30d',
    primaryHover: '#84cc16',
    secondary: '#0d9488',
    gradient: 'linear-gradient(135deg, #65a30d 0%, #84cc16 100%)',
    borderHover: 'rgba(101, 163, 13, 0.4)',
  },
  fuchsia: {
    primary: '#c026d3',
    primaryHover: '#d946ef',
    secondary: '#2563eb',
    gradient: 'linear-gradient(135deg, #c026d3 0%, #d946ef 100%)',
    borderHover: 'rgba(192, 38, 211, 0.4)',
  },
  indigo: {
    primary: '#4f46e5',
    primaryHover: '#6366f1',
    secondary: '#06b6d4',
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    borderHover: 'rgba(79, 70, 229, 0.4)',
  },
  slate: {
    primary: '#475569',
    primaryHover: '#64748b',
    secondary: '#334155',
    gradient: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
    borderHover: 'rgba(71, 85, 105, 0.4)',
  }
};

export const ThemeProvider = ({ children }) => {
  const [accent, setAccent] = useState(localStorage.getItem('theme-accent') || 'purple');
  const [visualizerStyle, setVisualizerStyle] = useState(localStorage.getItem('theme-visualizer-style') || 'bars');

  // Lock glassmorphism to premium visual defaults
  const opacity = 0.6;
  const blur = 12;

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
    localStorage.setItem('theme-visualizer-style', visualizerStyle);
  }, [accent, visualizerStyle]);

  return (
    <ThemeContext.Provider value={{ accent, setAccent, visualizerStyle, setVisualizerStyle }}>
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
