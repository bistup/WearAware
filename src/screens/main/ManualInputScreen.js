// author: caitriona mccann
// date: 27/11/2025
// manual entry screen if you don't want to use the camera
// enter brand, item type, and fiber composition manually - has dropdowns for easier selection

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Button from '../../components/Button';
import Input from '../../components/Input';
import FiberPickerModal from '../../components/FiberPickerModal';
import ItemTypePickerModal from '../../components/ItemTypePickerModal';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { saveScanToBackend } from '../../services/api';
import { uploadScanImages } from '../../services/imageUpload';
import { calculateImpactScore } from '../../utils/impactCalculator';
import { ITEM_TYPES } from '../../constants/constants';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

const ManualInputScreen = () => {
  const navigation = useNavigation();
  const { isGuest } = useAuth();
  const { showAlert } = useAlert();
  const [brand, setBrand] = useState('');
  const [itemType, setItemType] = useState('');
  const [selectedGender, setSelectedGender] = useState(null); // 'mens' or 'womens'
  const [isSecondHand, setIsSecondHand] = useState(false);
  const [fibers, setFibers] = useState([{ name: '', percentage: '' }]);
  const [loading, setLoading] = useState(false);
  const [showFiberPicker, setShowFiberPicker] = useState(false);
  const [showItemTypePicker, setShowItemTypePicker] = useState(false);
  const [currentFiberIndex, setCurrentFiberIndex] = useState(0);
  const [garmentImageUri, setGarmentImageUri] = useState(null);

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

  const handlePickGarmentImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setGarmentImageUri(result.assets[0].uri);
      }
    } catch (error) {
      showAlert('Error', 'Failed to pick image');
      console.error('Image picker error:', error);
    }
  };

  const styles = getStyles(colors, typography, spacing, borderRadius);

  const handleSubmit = async () => {
    // validation
    if (!brand.trim() || !itemType.trim()) {
      showAlert('Error', 'Please enter brand and item type');
      return;
    }

    const cleanedFibers = fibers.filter((f) => f.name.trim() && f.percentage);
    if (cleanedFibers.length === 0) {
      showAlert('Error', 'Please add at least one fiber');
      return;
    }

    const total = cleanedFibers.reduce((sum, f) => sum + parseFloat(f.percentage), 0);
    if (Math.abs(total - 100) > 0.1) {
      showAlert('Validation Error', `Fiber percentages must total 100% (current: ${total.toFixed(1)}%)`);
      return;
    }

    setLoading(true);

    // get weight for selected item type
    const selectedItem = ITEM_TYPES.find(item => item.name === itemType.trim());
    const itemWeightGrams = selectedItem ? selectedItem.weight : 300;

    // calculate impact with weight
    const { score, grade, waterUsage, carbonFootprint } = calculateImpactScore(cleanedFibers, itemWeightGrams, isSecondHand);

    // upload garment image if provided (and user is logged in)
    let imageUrl = null;
    let thumbnailUrl = null;
    if (garmentImageUri && !isGuest) {
      try {
        const uploadResult = await uploadScanImages(garmentImageUri, Date.now().toString());
        if (uploadResult.success) {
          imageUrl = uploadResult.imageUrl;
          thumbnailUrl = uploadResult.thumbnailUrl;
        } else {
          console.warn('Garment image upload failed:', uploadResult.error);
        }
      } catch (uploadErr) {
        console.warn('Garment image upload error:', uploadErr.message);
      }
    }

    const scanData = {
      brand: brand.trim(),
      itemType: itemType.trim(),
      itemWeightGrams,
      fibers: cleanedFibers.map((f) => ({
        name: f.name.trim(),
        percentage: parseFloat(f.percentage),
      })),
      score,
      grade,
      water_usage_liters: waterUsage,
      carbon_footprint_kg: carbonFootprint,
      item_weight_grams: itemWeightGrams,
      scanType: 'manual',
      imageUrl,
      thumbnailUrl,
      gender: selectedGender,
      isSecondHand,
    };

    const result = await saveScanToBackend(scanData);
    setLoading(false);

    // navigate to results if save succeeded
    if (result.success) {
      navigation.navigate('ScanResult', {
        scanData: result.scan || scanData,
        scanId: result.scanId,
      });
    } else {
      showAlert('Error', result.error || 'Failed to save data');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <View style={styles.backRow}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </View>
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
            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Gender</Text>
          <View style={styles.genderSelector}>
            <TouchableOpacity
              style={[styles.genderButton, selectedGender === 'mens' && styles.genderButtonActive]}
              onPress={() => setSelectedGender('mens')}
            >
              <Text style={[styles.genderButtonText, selectedGender === 'mens' && styles.genderButtonTextActive]}>Men's</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.genderButton, selectedGender === 'womens' && styles.genderButtonActive]}
              onPress={() => setSelectedGender('womens')}
            >
              <Text style={[styles.genderButtonText, selectedGender === 'womens' && styles.genderButtonTextActive]}>Women's</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Condition</Text>
          <TouchableOpacity
            style={[styles.secondHandToggle, isSecondHand && styles.secondHandToggleActive]}
            onPress={() => setIsSecondHand(!isSecondHand)}
            activeOpacity={0.7}
          >
            <Ionicons name={isSecondHand ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={isSecondHand ? colors.background : colors.textSecondary} />
            <Text style={[styles.secondHandText, isSecondHand && styles.secondHandTextActive]}>Second-hand / Pre-owned</Text>
          </TouchableOpacity>
          {isSecondHand && (
            <Text style={styles.secondHandHint}>Score boosted — reusing avoids ~80% of production impact</Text>
          )}
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
                <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
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
                  <Ionicons name="close-circle-outline" size={24} color={colors.error} />
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

        <Text style={styles.sectionTitle}>Garment Photo (Optional)</Text>
        <Text style={styles.sectionSubtitle}>Upload a photo for AI visual matching</Text>

        {garmentImageUri ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: garmentImageUri }} style={styles.imagePreview} />
            <View style={styles.imageActions}>
              <TouchableOpacity onPress={handlePickGarmentImage} style={styles.changeImageButton}>
                <Text style={styles.changeImageText}>Change Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setGarmentImageUri(null)} style={styles.removeImageButton}>
                <Text style={styles.removeImageText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={handlePickGarmentImage} style={styles.imagePicker}>
            <Ionicons name="image-outline" size={32} color={colors.textSecondary} style={{ marginBottom: spacing.xs }} />
            <Text style={styles.imagePickerText}>Upload Garment Photo</Text>
          </TouchableOpacity>
        )}

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
    minHeight: 44,
    justifyContent: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  genderSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  genderButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  genderButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  genderButtonTextActive: {
    color: colors.primary,
  },
  secondHandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondHandToggleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  secondHandText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  secondHandTextActive: {
    color: colors.background,
  },
  secondHandHint: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
    fontWeight: '500',
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
  imagePreviewContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  imagePreview: {
    width: 200,
    height: 260,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  imageActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  changeImageButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  changeImageText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  removeImageButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  removeImageText: {
    ...typography.bodySmall,
    color: colors.error,
    fontWeight: '600',
  },
  imagePicker: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  imagePickerIcon: {
    fontSize: 32,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  imagePickerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

export default ManualInputScreen;


