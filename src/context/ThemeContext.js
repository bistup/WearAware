import React, { createContext, useContext, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings } from 'react-native';
import { applyTheme } from '../theme/theme';

const THEME_MODE_KEY = 'wearaware.themeMode';
const ThemeContext = createContext();

export const ThemeProvider = ({ initialMode = 'light', children }) => {
  const [mode, setMode] = useState(initialMode === 'dark' ? 'dark' : 'light');

  const setThemeMode = async (nextMode) => {
    const normalized = nextMode === 'dark' ? 'dark' : 'light';
    setMode(normalized);
    applyTheme(normalized);
    await AsyncStorage.setItem(THEME_MODE_KEY, normalized);

    // Most screens use static StyleSheet values, so a full reload is required
    // to rebuild styles with the selected palette.
    if (DevSettings && typeof DevSettings.reload === 'function') {
      DevSettings.reload();
    }
  };

  const toggleThemeMode = async () => {
    await setThemeMode(mode === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(() => ({
    mode,
    isDarkMode: mode === 'dark',
    setThemeMode,
    toggleThemeMode,
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
};

export { THEME_MODE_KEY };
