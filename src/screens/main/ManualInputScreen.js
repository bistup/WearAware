// author: caitriona mccann
// date: 27/11/2025
// manual entry screen if you don't want to use the camera
// enter brand, item type, and fiber composition manually - has dropdowns for easier selection

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/Button';
import Input from '../../components/Input';
import FiberPickerModal from '../../components/FiberPickerModal';
import ItemTypePickerModal from '../../components/ItemTypePickerModal';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { saveScanToBackend } from '../../services/api';
import { calculateImpactScore } from '../../utils/impactCalculator';
import { ITEM_TYPES } from '../../constants/itemTypes';

const ManualInputScreen = () => {
  const navigation = useNavigation();
  const [brand, setBrand] = useState('');
  const [itemType, setItemType] = useState('');
  const [fibers, setFibers] = useState([{ name: '', percentage: '' }]);
  const [loading, setLoading] = useState(false);
  const [showFiberPicker, setShowFiberPicker] = useState(false);
  const [showItemTypePicker, setShowItemTypePicker] = useState(false);
  const [currentFiberIndex, setCurrentFiberIndex] = useState(0);

  const handleAddFiber = () => {
    setFibers([...fibers, { name: '', percentage: '' }]);
  };

  const handleRemoveFiber = (index) => {
    if (fibers.length > 1) {
      const newFibers = fibers.filter((_, i) => i !== index);
      setFibers(newFibers);
    }
  };

  const handleFiberChange = (index, field, value) => {
    const newFibers = [...fibers];
    newFibers[index][field] = value;
    setFibers(newFibers);
  };

  const openFiberPicker = (index) => {
    setCurrentFiberIndex(index);
    setShowFiberPicker(true);
  };

  const selectFiber = (fiberName) => {
    const newFibers = [...fibers];
    newFibers[currentFiberIndex].name = fiberName;
    setFibers(newFibers);
    setShowFiberPicker(false);
  };

  const selectItemType = (item) => {
    setItemType(item.name);
    setShowItemTypePicker(false);
  };

  const styles = getStyles(colors, typography, spacing, borderRadius);

  const handleSubmit = async () => {
    // Validation
    if (!brand.trim() || !itemType.trim()) {
      Alert.alert('Error', 'Please enter brand and item type');
      return;
    }

    const cleanedFibers = fibers.filter((f) => f.name.trim() && f.percentage);
    if (cleanedFibers.length === 0) {
      Alert.alert('Error', 'Please add at least one fiber');
      return;
    }

    const total = cleanedFibers.reduce((sum, f) => sum + parseFloat(f.percentage), 0);
    if (Math.abs(total - 100) > 0.1) {
      Alert.alert('Validation Error', `Fiber percentages must total 100% (current: ${total.toFixed(1)}%)`);
      return;
    }

    setLoading(true);

    // Calculate impact
    const { score, grade } = calculateImpactScore(cleanedFibers);

    const scanData = {
      brand: brand.trim(),
      itemType: itemType.trim(),
      fibers: cleanedFibers.map((f) => ({
        name: f.name.trim(),
        percentage: parseFloat(f.percentage),
      })),
      score,
      grade,
      scanType: 'manual',
    };

    const result = await saveScanToBackend(scanData);
    setLoading(false);

    // navigate to results if save succeeded
    if (result.success) {
      navigation.navigate('ScanResult', {
        scanData: result.scan || scanData, // use backend data if available
        scanId: result.scanId,
      });
    } else {
      Alert.alert('Error', result.error || 'Failed to save data');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Manual Entry</Text>
        <Text style={styles.subtitle}>Enter garment details manually</Text>

        <Input label="Brand" value={brand} onChangeText={setBrand} placeholder="Brand name" />

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Item Type</Text>
          <TouchableOpacity
            onPress={() => setShowItemTypePicker(true)}
            style={styles.itemTypeSelector}
          >
            <Text style={itemType ? styles.selectedItemType : styles.placeholderText}>
              {itemType || 'Select item type...'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Fiber Composition</Text>
        <Text style={styles.sectionSubtitle}>Percentages must total 100%</Text>

        {fibers.map((fiber, index) => (
          <View key={index} style={styles.fiberContainer}>
            <Text style={styles.fiberRowLabel}>Fiber {index + 1}</Text>
            <View style={styles.fiberRow}>
              <TouchableOpacity
                onPress={() => openFiberPicker(index)}
                style={styles.fiberSelector}
              >
                <Text style={fiber.name ? styles.selectedFiber : styles.placeholderText}>
                  {fiber.name || 'Select type...'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              
              <TextInput
                style={styles.percentInput}
                value={fiber.percentage.toString()}
                onChangeText={(value) => handleFiberChange(index, 'percentage', value)}
                placeholder="%"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />
              
              {fibers.length > 1 && (
                <TouchableOpacity
                  onPress={() => handleRemoveFiber(index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        <Button
          title="+ Add Another Fiber"
          onPress={handleAddFiber}
          variant="secondary"
          style={styles.addButton}
        />

        <Button title="Calculate Impact" onPress={handleSubmit} loading={loading} />
      </ScrollView>

      {/* reusable modals for fiber and item type selection */}
      <FiberPickerModal
        visible={showFiberPicker}
        onClose={() => setShowFiberPicker(false)}
        onSelect={selectFiber}
      />

      <ItemTypePickerModal
        visible={showItemTypePicker}
        onClose={() => setShowItemTypePicker(false)}
        onSelect={selectItemType}
        selectedType={itemType}
      />
    </SafeAreaView>
  );
};

const getStyles = (colors, typography, spacing, borderRadius) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.bodySmall,
    fontWeight: '500',
    marginBottom: spacing.xs,
    color: colors.text,
  },
  itemTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surface,
    minHeight: 52,
  },
  selectedItemType: {
    ...typography.body,
    color: colors.text,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  fiberContainer: {
    marginBottom: spacing.md,
  },
  fiberRowLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.xs,
    color: colors.text,
  },
  fiberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fiberSelector: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    minHeight: 52,
  },
  selectedFiber: {
    ...typography.body,
    color: colors.text,
  },
  placeholderText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  dropdownArrow: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  percentInput: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    width: 90,
    minHeight: 52,
    textAlign: 'center',
  },
  removeButton: {
    width: 40,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    fontSize: 20,
    color: colors.error,
  },
  addButton: {
    marginBottom: spacing.lg,
  },
});

export default ManualInputScreen;


