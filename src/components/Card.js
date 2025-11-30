// author: caitriona mccann
// date: 26/11/2025
// simple card wrapper with soft shadows
// wraps content in a nice white container

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
    ...shadows.soft,
  },
});

export default Card;


