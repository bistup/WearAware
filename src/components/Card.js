// author: caitriona mccann
// date: 26/11/2025
// last updated: 12/02/2026
// card wrapper - modern dark surface with subtle border glow
// glassmorphism-inspired elevated panel

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, borderRadius, spacing, shadows } from '../theme/theme';

const Card = ({ children, style }) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
});

export default Card;


