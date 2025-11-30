// author: caitriona mccann
// date: 28/11/2025
// reusable modal for selecting clothing item type with weight display

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import Button from './Button';
import { colors, typography, spacing, borderRadius } from '../theme/theme';
import { ITEM_TYPES } from '../constants/itemTypes';

// bottom sheet modal showing items with weights and selection checkmark
const ItemTypePickerModal = ({ visible, onClose, onSelect, selectedType }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide" // slides up from bottom
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Select Item Type</Text>
          {/* flatlist for efficient rendering of all item types */}
          <FlatList
            data={ITEM_TYPES}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.option,
                  selectedType === item.name && styles.selectedOption, // highlight selected
                ]}
                onPress={() => onSelect(item)}
              >
                <View>
                  <Text style={[
                    styles.itemName,
                    selectedType === item.name && styles.selectedText,
                  ]}>
                    {item.name}
                  </Text>
                  {/* show weight below each item name */}
                  <Text style={styles.itemWeight}>~{item.weight}g</Text>
                </View>
                {/* checkmark for currently selected item */}
                {selectedType === item.name && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            )}
          />
          <Button
            title="Cancel"
            onPress={onClose}
            variant="secondary"
          />
        </View>
      </View>
    </Modal>
  );
};

// bottom sheet style modal that slides up from bottom of screen
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // dark semi-transparent background
    justifyContent: 'flex-end', // anchor modal to bottom
  },
  content: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg, // rounded top corners
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '80%', // allow space above modal
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between', // name on left, checkmark on right
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedOption: {
    backgroundColor: colors.surfaceSecondary, // highlight selected row
  },
  itemName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  selectedText: {
    color: colors.primary, // mint color for selected item
    fontWeight: '600',
  },
  itemWeight: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2, // shows below item name
  },
  checkmark: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: 'bold',
  },
});

export default ItemTypePickerModal;


