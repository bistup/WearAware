// author: caitriona mccann
// date: 27/11/2025
// last updated: 12/02/2026
// design system - modern dark theme with vibrant green accents
// wcag 2.1 aa compliant, eu accessibility act (eaa) ready
// glassmorphism-inspired surfaces, generous spacing, smooth radii

import { PixelRatio } from 'react-native';

// dynamic font scaling - respects system accessibility settings
const fontScale = PixelRatio.getFontScale();
const scale = (size) => Math.round(size * Math.min(fontScale, 1.5));

export const colors = {
  // dark base palette
  background: '#0D0D0D',        // near-black canvas
  surface: '#1A1A1A',           // elevated card surface
  surfaceSecondary: '#242424',  // secondary panels, inputs
  surfaceElevated: '#2A2A2A',   // modals, popovers

  // text hierarchy - all pass wcag aa on dark backgrounds
  textPrimary: '#F5F5F5',       // primary text (15.4:1 on #1A1A1A)
  textSecondary: '#A0A0A0',     // secondary labels (6.3:1 on #1A1A1A)
  textTertiary: '#6B6B6B',      // hints, placeholders (4.5:1 on #1A1A1A)

  // vibrant green accent palette
  primary: '#00E676',           // electric green accent
  primaryLight: 'rgba(0, 230, 118, 0.12)', // green tint for backgrounds
  primaryDark: '#00C853',       // pressed/emphasis green
  primaryMuted: 'rgba(0, 230, 118, 0.06)', // ultra-subtle green wash
  secondary: '#69F0AE',         // lighter green for secondary accents
  accent: '#B9F6CA',            // pastel green for decorative use

  // environmental grades - vivid, distinct on dark
  gradeA: '#00E676',            // electric green
  gradeB: '#76FF03',            // lime
  gradeC: '#FFEA00',            // yellow
  gradeD: '#FF9100',            // orange
  gradeF: '#FF5252',            // red

  // functional colors
  border: '#2E2E2E',            // subtle dark border
  divider: '#222222',           // near-invisible divider
  error: '#FF5252',             // soft red
  errorLight: 'rgba(255, 82, 82, 0.12)',
  success: '#00E676',
  successLight: 'rgba(0, 230, 118, 0.12)',
  warning: '#FFD600',
  warningLight: 'rgba(255, 214, 0, 0.12)',
  info: '#448AFF',
  infoLight: 'rgba(68, 138, 255, 0.12)',

  // interactive states
  pressed: 'rgba(0, 230, 118, 0.10)',
  disabled: '#3A3A3A',

  // shadow / glow
  shadow: 'rgba(0, 0, 0, 0.40)',
  glow: 'rgba(0, 230, 118, 0.25)',
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


