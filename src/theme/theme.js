// author: caitriona mccann
// date: 27/11/2025
// all the design stuff in one place - colors, fonts, spacing
// using mint green palette because it looks clean and matches the sustainable vibe

export const colors = {
  // Nature-inspired green palette
  background: '#d8f3dc',        // Frosted Mint - main background
  surface: '#FFFFFF',
  surfaceSecondary: '#b7e4c7',  // Celadon - secondary surfaces
  
  // Text hierarchy
  textPrimary: '#1b4332',       // Pine Teal - primary text
  textSecondary: '#2d6a4f',     // Hunter Green - secondary text
  textTertiary: '#40916c',      // Sea Green - tertiary text
  
  // Accent colors (green harmony)
  primary: '#52b788',           // Mint Leaf - primary actions
  primaryDark: '#40916c',       // Sea Green - primary dark
  secondary: '#74c69d',         // Mint Leaf lighter - secondary
  
  // Environmental grades
  gradeA: '#52b788',            // Mint Leaf - excellent
  gradeB: '#74c69d',            // Mint Leaf lighter - good
  gradeC: '#95d5b2',            // Celadon - average
  gradeD: '#b7e4c7',            // Celadon lighter - below average
  gradeF: '#d8f3dc',            // Frosted Mint - poor
  
  // Functional colors
  border: '#95d5b2',            // Celadon - borders
  divider: '#b7e4c7',           // Celadon lighter - dividers
  error: '#2d6a4f',             // Hunter Green - errors
  success: '#52b788',           // Mint Leaf - success
  
  // Shadow
  shadow: 'rgba(27, 67, 50, 0.1)',  // Pine Teal shadow
};

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
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: colors.textTertiary,
  },
  button: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const shadows = {
  soft: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
};


