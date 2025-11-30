// author: caitriona mccann
// date: 27/11/2025
// displays the environmental grade (A-F) with color coding
// green for good grades, lighter colors for worse grades

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, borderRadius, spacing } from '../theme/theme';

const GradeIndicator = ({ grade, size = 'large' }) => {
  const getGradeColor = (grade) => {
    const gradeMap = {
      A: colors.gradeA,
      B: colors.gradeB,
      C: colors.gradeC,
      D: colors.gradeD,
      F: colors.gradeF,
    };
    return gradeMap[grade] || colors.textTertiary;
  };

  const isLarge = size === 'large';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: getGradeColor(grade) },
        isLarge ? styles.large : styles.small,
      ]}
    >
      <Text style={[styles.gradeText, isLarge ? styles.largeText : styles.smallText]}>
        {grade}
      </Text>
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
  },
  small: {
    width: 40,
    height: 40,
  },
  gradeText: {
    color: colors.surface,
    fontWeight: '700',
  },
  largeText: {
    fontSize: 40,
  },
  smallText: {
    fontSize: 20,
  },
});

export default GradeIndicator;


