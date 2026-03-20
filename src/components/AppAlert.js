// author: caitriona mccann
// date: 19/03/2026
// custom alert component - replaces native Alert.alert throughout the app
// bottom sheet style, matches the app design system

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/theme';

const AppAlert = ({ visible, title, message, buttons = [], onDismiss }) => {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 30,
          stiffness: 320,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const cancelBtn = buttons.find(b => b.style === 'cancel');
  const actionBtns = buttons.filter(b => b.style !== 'cancel');

  // if no buttons provided, default to a single OK
  const effectiveActions = actionBtns.length > 0 ? actionBtns : [{ text: 'OK' }];

  const handlePress = (btn) => {
    onDismiss();
    if (btn?.onPress) btn.onPress();
  };

  const handleBackdropPress = () => {
    if (cancelBtn) {
      handlePress(cancelBtn);
    } else {
      onDismiss();
    }
  };

  const getButtonColor = (btn) => {
    if (btn.style === 'destructive') return '#EF4444';
    return colors.primary;
  };

  const getButtonWeight = (btn, index, total) => {
    if (btn.style === 'destructive') return '500';
    // last non-cancel action is the "main" action
    if (index === total - 1 && btn.style !== 'destructive') return '700';
    return '500';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleBackdropPress}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents="box-none"
      >
        {/* Main block: header + action buttons */}
        <View style={styles.mainBlock}>
          {/* Header */}
          {(title || message) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {message && <Text style={styles.message}>{message}</Text>}
            </View>
          )}

          {/* Action buttons */}
          {effectiveActions.map((btn, i) => (
            <React.Fragment key={i}>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.button}
                onPress={() => handlePress(btn)}
                activeOpacity={0.55}
              >
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color: getButtonColor(btn),
                      fontWeight: getButtonWeight(btn, i, effectiveActions.length),
                    },
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* Cancel block */}
        {cancelBtn && (
          <View style={styles.cancelBlock}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => handlePress(cancelBtn)}
              activeOpacity={0.55}
            >
              <Text style={styles.cancelText}>{cancelBtn.text}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.md,
    gap: spacing.sm,
  },
  mainBlock: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  title: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  button: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    fontSize: 17,
    letterSpacing: -0.2,
  },
  cancelBlock: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: -0.2,
  },
});

export default AppAlert;
