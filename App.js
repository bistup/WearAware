// author: caitriona mccann
// date: 26/11/2025
// main entry point for the app - sets up navigation and context providers so everything works together

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, THEME_MODE_KEY, useThemeMode } from './src/context/ThemeContext';
import { applyTheme, colors } from './src/theme/theme';

const AppShell = ({ RootNavigator }) => {
  const { isDarkMode } = useThemeMode();

  const baseTheme = isDarkMode ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    dark: isDarkMode,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics ?? { frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AuthProvider>
        <NavigationContainer theme={navigationTheme}>
          <RootNavigator />
          <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default function App() {
  const [initialMode, setInitialMode] = useState('light');
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const bootstrapTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_MODE_KEY);
        const mode = savedMode === 'dark' ? 'dark' : 'light';
        applyTheme(mode);
        if (mounted) {
          setInitialMode(mode);
        }
      } catch {
        applyTheme('light');
      } finally {
        if (mounted) {
          setThemeReady(true);
        }
      }
    };

    bootstrapTheme();
    return () => {
      mounted = false;
    };
  }, []);

  const RootNavigator = useMemo(() => {
    if (!themeReady) return null;
    return require('./src/navigation/RootNavigator').default;
  }, [themeReady]);

  if (!themeReady || !RootNavigator) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <ThemeProvider initialMode={initialMode}>
      <AppShell RootNavigator={RootNavigator} />
    </ThemeProvider>
  );
}

