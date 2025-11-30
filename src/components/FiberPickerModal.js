// author: caitriona mccann
// date: 28/11/2025
// reusable modal for selecting fiber type from list

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Card from './Card';
import Button from './Button';
import { colors, typography, spacing, borderRadius } from '../theme/theme';
import { FIBER_TYPES } from '../constants/fiberTypes';

// modal component for picking a fiber from centralized list
const FiberPickerModal = ({ visible, onClose, onSelect }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* overlay that dismisses modal when tapped */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.content}>
          <Card style={styles.card}>
            <Text style={styles.title}>Select Fiber Type</Text>
            {/* scrollable list of all available fibers */}
            <ScrollView style={styles.list}>
              {FIBER_TYPES.map((fiber) => (
                <TouchableOpacity
                  key={fiber}
                  style={styles.option}
                  onPress={() => onSelect(fiber)}
                >
                  <Text style={styles.optionText}>{fiber}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              title="Cancel"
              onPress={onClose}
              variant="secondary"
            />
          </Card>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// centered modal with semi-transparent overlay
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // dark semi-transparent background
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    maxHeight: '80%', // prevent modal from covering entire screen
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  list: {
    maxHeight: 400, // scrollable if many fibers
    marginBottom: spacing.md,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
});

export default FiberPickerModal;


