// author: caitriona mccann
// date: 27/11/2025
// last updated: 04/03/2026
// design system - clean light theme with nature-inspired green accents
// wcag 2.1 aa compliant, eu accessibility act (eaa) ready
// backwards-compatible exports for all existing screens

import { PixelRatio } from 'react-native';

// dynamic font scaling - respects system accessibility settings
const fontScale = PixelRatio.getFontScale();
const scale = (size) => Math.round(size * Math.min(fontScale, 1.5));

export const colors = {
  // light base palette
  background: '#F7F9F8',        // soft off-white canvas
  surface: '#FFFFFF',           // elevated card surface
  surfaceSecondary: '#EEF1EF',  // secondary panels, inputs
  surfaceElevated: '#FFFFFF',   // modals, popovers

  // text hierarchy
  textPrimary: '#0A1A14',       // near-black primary text
  textSecondary: '#5E7068',     // secondary labels
  textTertiary: '#6B7D76',      // hints, placeholders (darkened for WCAG AA contrast)

  // green accent palette
  primary: '#1A6B4A',           // deep forest green
  primaryLight: 'rgba(26, 107, 74, 0.10)', // green tint for backgrounds
  primaryDark: '#145A3D',       // pressed/emphasis green
  primaryMuted: 'rgba(26, 107, 74, 0.05)', // ultra-subtle green wash
  secondary: '#00C96A',         // vibrant green for secondary accents
  accent: '#00C96A',            // bright green for decorative use

  // environmental grades - vivid, distinct on light
  gradeA: '#00C96A',            // green
  gradeB: '#7ED957',            // lime
  gradeC: '#FFD166',            // amber
  gradeD: '#FF9F43',            // orange
  gradeF: '#C0392B',            // red

  // functional colors
  border: '#E8EBE9',            // subtle light border
  divider: '#E0E4E2',           // soft divider
  error: '#C0392B',             // crimson red
  errorLight: 'rgba(192, 57, 43, 0.10)',
  success: '#00C96A',
  successLight: 'rgba(0, 201, 106, 0.10)',
  warning: '#FFD166',
  warningLight: 'rgba(255, 209, 102, 0.12)',
  info: '#448AFF',
  infoLight: 'rgba(68, 138, 255, 0.10)',

  // interactive states
  pressed: 'rgba(26, 107, 74, 0.10)',
  disabled: '#C8CEC9',

  // shadow / glow
  shadow: 'rgba(0, 0, 0, 0.08)',
  glow: 'rgba(0, 201, 106, 0.20)',
};

const LIGHT_COLORS = { ...colors };

const DARK_COLORS = {
  background: '#0E1412',
  surface: '#14201C',
  surfaceSecondary: '#1B2A24',
  surfaceElevated: '#1A2722',

  textPrimary: '#EAF3EF',
  textSecondary: '#AFC3BA',
  textTertiary: '#9BB5AC',      // darkened for WCAG AA contrast on dark background

  primary: '#49B386',
  primaryLight: 'rgba(73, 179, 134, 0.18)',
  primaryDark: '#2F9A6D',
  primaryMuted: 'rgba(73, 179, 134, 0.12)',
  secondary: '#32D890',
  accent: '#32D890',

  gradeA: '#32D890',
  gradeB: '#9AE46D',
  gradeC: '#F5CB67',
  gradeD: '#F4A261',
  gradeF: '#E76F51',

  border: '#24362F',
  divider: '#213129',
  error: '#E76F51',
  errorLight: 'rgba(231, 111, 81, 0.16)',
  success: '#32D890',
  successLight: 'rgba(50, 216, 144, 0.16)',
  warning: '#F5CB67',
  warningLight: 'rgba(245, 203, 103, 0.16)',
  info: '#7CB7FF',
  infoLight: 'rgba(124, 183, 255, 0.16)',

  pressed: 'rgba(73, 179, 134, 0.18)',
  disabled: '#42544D',

  shadow: 'rgba(0, 0, 0, 0.35)',
  glow: 'rgba(50, 216, 144, 0.28)',
};

// backwards compatibility aliases
colors.text = colors.textPrimary;
colors.cardBackground = colors.surface;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: {
    fontSize: scale(30),
    fontWeight: '800',
    letterSpacing: -0.8,
    color: colors.textPrimary,
    lineHeight: scale(38),
  },
  h2: {
    fontSize: scale(22),
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.textPrimary,
    lineHeight: scale(28),
  },
  h3: {
    fontSize: scale(18),
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.textPrimary,
    lineHeight: scale(24),
  },
  body: {
    fontSize: scale(15),
    fontWeight: '400',
    lineHeight: scale(22),
    color: colors.textPrimary,
  },
  bodySmall: {
    fontSize: scale(13),
    fontWeight: '400',
    lineHeight: scale(18),
    color: colors.textSecondary,
  },
  caption: {
    fontSize: scale(11),
    fontWeight: '500',
    lineHeight: scale(16),
    color: colors.textTertiary,
  },
  button: {
    fontSize: scale(15),
    fontWeight: '700',
    letterSpacing: 0.4,
  },
};

export const borderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
};

export const shadows = {
  soft: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  medium: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: {
    shadowColor: colors.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },
};

// minimum touch target size per wcag 2.5.5 / eaa (44x44 dp)
export const accessibility = {
  minTouchTarget: 44,
  focusBorderWidth: 2,
  focusBorderColor: colors.primary,
};

function applyDerivedThemeTokens() {
  // backwards compatibility aliases
  colors.text = colors.textPrimary;
  colors.cardBackground = colors.surface;

  typography.h1.color = colors.textPrimary;
  typography.h2.color = colors.textPrimary;
  typography.h3.color = colors.textPrimary;
  typography.body.color = colors.textPrimary;
  typography.bodySmall.color = colors.textSecondary;
  typography.caption.color = colors.textTertiary;

  shadows.soft.shadowColor = colors.shadow;
  shadows.medium.shadowColor = colors.shadow;
  shadows.glow.shadowColor = colors.glow;

  accessibility.focusBorderColor = colors.primary;
}

export function applyTheme(mode = 'light') {
  const source = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  Object.keys(source).forEach((key) => {
    colors[key] = source[key];
  });
  applyDerivedThemeTokens();
}

// maps grade letter to accessible color
export function getGradeColor(grade) {
  const map = {
    A: colors.gradeA,
    B: colors.gradeB,
    C: colors.gradeC,
    D: colors.gradeD,
    F: colors.gradeF,
  };
  return map[grade] || colors.textTertiary;
}

// grade label text for screen readers and additional context
export function getGradeLabel(grade) {
  const map = {
    A: 'Excellent',
    B: 'Good',
    C: 'Average',
    D: 'Below Average',
    F: 'Poor',
  };
  return map[grade] || 'Unknown';
}
  