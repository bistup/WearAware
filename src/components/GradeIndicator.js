// author: caitriona mccann
// date: 27/11/2025
// last updated: 12/02/2026
// displays the environmental grade (a-f) with vivid color coding
// modern rounded pill with subtle glow, wcag compliant
// includes text label for screen readers

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, borderRadius, spacing, getGradeColor, getGradeLabel } from '../theme/theme';

const GradeIndicator = ({ grade, size = 'large' }) => {
  const isLarge = size === 'large';
  const isMedium = size === 'medium';
  const gradeColor = getGradeColor(grade);
  const gradeLabel = getGradeLabel(grade);
  
  // grades C/D use dark text for contrast on bright yellow/orange bg
  const needsDarkText = grade === 'C' || grade === 'D';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: gradeColor },
        isLarge ? styles.large : isMedium ? styles.medium : styles.small,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Grade ${grade}, ${gradeLabel}`}
    >
      <Text style={[
        styles.gradeText,
        isLarge ? styles.largeText : isMedium ? styles.mediumText : styles.smallText,
        needsDarkText ? styles.darkText : styles.lightText,
      ]}>
        {grade}
      </Text>
      {isLarge && (
        <Text style={[styles.labelText, needsDarkText && styles.darkLabelText]}>
          {gradeLabel}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  large: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
  },
  medium: {
    width: 52,
    height: 52,
  },
  small: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.sm,
  },
  gradeText: {
    fontWeight: '800',
  },
  lightText: {
    color: colors.background,
  },
  darkText: {
    color: '#1A1A1A',
  },
  largeText: {
    fontSize: 32,
  },
  mediumText: {
    fontSize: 22,
  },
  smallText: {
    fontSize: 18,
  },
  labelText: {
    color: 'rgba(13, 13, 13, 0.7)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: -2,
  },
  darkLabelText: {
    color: 'rgba(26, 26, 26, 0.7)',
  },
});

export default GradeIndicator;


