// author: caitriona mccann
// date: 26/11/2025
// last updated: 12/02/2026
// reusable text input - modern dark surface with subtle border
// eaa compliant: min 48dp touch target, error announced to screen readers

import React from 'react';
import { TextInput, View, Text, StyleSheet } from 'react-native';
import { colors, typography, borderRadius, spacing, accessibility } from '../theme/theme';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  multiline = false,
  style,
  accessibilityHint,
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
          error && styles.inputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        accessibilityLabel={label || placeholder}
        accessibilityHint={accessibilityHint || (error ? `Error: ${error}` : undefined)}
        accessibilityState={{ disabled: false }}
      />
      {error && (
        <Text
          style={styles.errorText}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    minHeight: accessibility.minTouchTarget + 4,
    color: colors.textPrimary,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: spacing.sm + 4,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 1.5,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
});

export default Input;


