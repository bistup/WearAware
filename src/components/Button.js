// author: caitriona mccann
// date: 26/11/2025
// last updated: 12/02/2026
// reusable button component - modern dark theme with vibrant green accent
// eaa compliant: min 48px touch target, accessibility labels

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, typography, borderRadius, spacing, shadows, accessibility } from '../theme/theme';

const Button = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  disabled = false,
  loading = false,
  style,
  accessibilityHint,
}) => {
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={loading ? `${title}, loading` : title}
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityHint={accessibilityHint}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.background : colors.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isPrimary ? styles.primaryText : styles.secondaryText,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: accessibility.minTouchTarget + 4,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    ...shadows.glow,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  disabledButton: {
    opacity: 0.4,
  },
  buttonText: {
    ...typography.button,
  },
  primaryText: {
    color: colors.background,
  },
  secondaryText: {
    color: colors.primary,
  },
});

export default Button;


