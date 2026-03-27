// author: caitriona mccann
// date: 27/11/2025
// camera screen that asks for brand and item type first, then lets you scan the label
// connects to google vision api to read the text from clothing labels

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ItemTypePickerModal from '../../components/ItemTypePickerModal';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { processImageHybrid } from '../../services/hybridOcr';
import { saveScanToBackend } from '../../services/api';
import { calculateImpactScore } from '../../utils/impactCalculator';
import { ITEM_TYPES } from '../../constants/constants';
import { uploadScanImages } from '../../services/imageUpload';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

const CameraScreen = () => {
  const navigation = useNavigation();
  const { isGuest } = useAuth();
  const { showAlert } = useAlert();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [showPreScanForm, setShowPreScanForm] = useState(true);
  const [brandName, setBrandName] = useState('');
  const [selectedItemType, setSelectedItemType] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null); // 'mens' or 'womens'
  const [isSecondHand, setIsSecondHand] = useState(false);
  const [showItemTypeModal, setShowItemTypeModal] = useState(false);
  const cameraRef = useRef(null);

  // two-step flow state for full scan
  const [scanStep, setScanStep] = useState('label'); // 'label' or 'garment'
  const [labelScanData, setLabelScanData] = useState(null); // stores OCR result from step 1

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'tops':
        return 'shirt-outline';
      case 'bottoms':
        return 'walk-outline';
      case 'outerwear':
        return 'snow-outline';
      case 'dresses':
        return 'woman-outline';
      case 'undergarments':
        return 'ellipse-outline';
      case 'accessories':
        return 'sparkles-outline';
      default:
        return 'cube-outline';
    }
  };

  // start scanning after user makes selection
  const handleStartScanning = () => {
    if (!brandName.trim()) {
      showAlert('Required', 'Please enter the brand name');
      return;
    }
    if (!selectedItemType) {
      showAlert('Required', 'Please select an item type');
      return;
    }
    // start at step 1 (label scan)
    setScanStep('label');
    setLabelScanData(null);
    setShowPreScanForm(false);
  };

  // pick image from gallery
  const handlePickImage = async () => {
    // validate brand/item type before proceeding
    if (showPreScanForm) {
      if (!brandName.trim()) {
        showAlert('Required', 'Please enter the brand name');
        return;
      }
      if (!selectedItemType) {
        showAlert('Required', 'Please select an item type');
        return;
      }
    }

    if (scanStep === 'label') {
      // step 1: pick label image for OCR
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          setLoading(true);
          await processLabelImage(result.assets[0].uri);
        }
      } catch (error) {
        showAlert('Error', 'Failed to pick image');
        console.error('Image picker error:', error);
      }
    } else {
      // step 2: pick garment photo
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          setLoading(true);
          await processGarmentImage(result.assets[0].uri);
        }
      } catch (error) {
        showAlert('Error', 'Failed to pick image');
        console.error('Image picker error:', error);
      }
    }
  };

  // handle camera permission check
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            Camera access is required to scan labels
          </Text>
          <Button title="Grant Permission" onPress={requestPermission} />
          <Button
            title="Go Back"
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs', { screen: 'Home' })}
            variant="secondary"
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // capture photo and process based on current mode/step
  const handleCapture = async () => {
    if (!cameraRef.current || loading) return;

    try {
      setLoading(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (scanStep === 'label') {
        // step 1: scan the label for fibers/OCR
        await processLabelImage(photo.uri);
      } else {
        // step 2: photograph the garment
        await processGarmentImage(photo.uri);
      }
    } catch (error) {
      setLoading(false);
      showAlert('Error', 'Failed to capture photo. Please try again.');
      console.error('Capture error:', error);
    }
  };

  // =====================================================================
  // STEP 1: Process label image with OCR (extracts fibers, country)
  // =====================================================================
  const processLabelImage = async (imageUri) => {
    try {
      // process with hybrid OCR (Vision API online, manual fallback offline)
      const ocrResult = await processImageHybrid(imageUri);

      console.log(`Label scan processed with: ${ocrResult.method}`);

      if (!ocrResult.success) {
        setLoading(false);
        showAlert(
          'Scan Failed',
          ocrResult.error || 'Could not detect text from the label. Would you like to try again or enter details manually?',
          [
            { text: 'Try Again', style: 'default' },
            {
              text: 'Manual Input',
              onPress: () => navigation.replace('ManualInput'),
            },
          ]
        );
        return;
      }

      // check for fiber data
      if (!ocrResult.data.fibers || ocrResult.data.fibers.length === 0) {
        setLoading(false);
        showAlert(
          'No Fiber Information Detected',
          'We couldn\'t detect fiber composition from this label. Would you like to try again or enter manually?',
          [
            { text: 'Try Again', style: 'default' },
            {
              text: 'Manual Input',
              onPress: () => navigation.replace('ManualInput'),
            },
          ]
        );
        return;
      }

      // store OCR result and advance to step 2 (garment photo)
      setLabelScanData(ocrResult.data);
      setScanStep('garment');
      setShowPreScanForm(false);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      showAlert('Error', 'Failed to process label image: ' + error.message);
      console.error('Label scan error:', error);
    }
  };

  // =====================================================================
  // STEP 2: Process garment image (upload + save combined scan)
  // =====================================================================
  const processGarmentImage = async (imageUri) => {
    if (isGuest) {
      setLoading(false);
      showAlert('Sign In Required', 'Create an account to save scans. Image upload requires authentication.');
      return;
    }

    if (!labelScanData) {
      setLoading(false);
      showAlert('Missing Label Scan', 'Please scan the care label first before photographing the garment.');
      setScanStep('label');
      return;
    }

    try {
      // upload garment image to Firebase Storage
      console.log('Uploading garment image to Firebase Storage...');
      let uploadResult = { success: false };
      try {
        uploadResult = await uploadScanImages(imageUri, Date.now().toString());
        if (!uploadResult.success) {
          console.warn('Garment image upload failed:', uploadResult.error);
        }
      } catch (uploadErr) {
        console.warn('Garment image upload error:', uploadErr.message);
      }

      // combine label OCR data with garment image and form data
      const scanData = {
        ...labelScanData,
        brand: brandName.trim(),
        itemType: selectedItemType.name,
        itemWeightGrams: selectedItemType.weight,
        imageUrl: uploadResult.success ? uploadResult.imageUrl : null,
        thumbnailUrl: uploadResult.success ? uploadResult.thumbnailUrl : null,
        gender: selectedGender,
        isSecondHand,
      };

      // save to backend (backend will also extract CLIP embedding if image provided)
      const saveResult = await saveScanToBackend(scanData);

      // if backend didn't return calculations, calculate on frontend
      let finalScanData = saveResult.scan || scanData;
      if (!finalScanData.water_usage_liters || !finalScanData.carbon_footprint_kg) {
        const { score, grade, waterUsage, carbonFootprint } = calculateImpactScore(
          scanData.fibers,
          scanData.itemWeightGrams
        );
        finalScanData = {
          ...finalScanData,
          score,
          grade,
          water_usage_liters: waterUsage,
          carbon_footprint_kg: carbonFootprint,
          item_weight_grams: scanData.itemWeightGrams,
        };
      }

      // navigate to results with combined data
      navigation.navigate('ScanResult', {
        scanData: {
          ...finalScanData,
          imageUrl: uploadResult.success ? uploadResult.imageUrl : finalScanData.imageUrl,
          thumbnailUrl: uploadResult.success ? uploadResult.thumbnailUrl : finalScanData.thumbnailUrl,
        },
        scanId: saveResult.scanId,
      });

      setLoading(false);
    } catch (error) {
      setLoading(false);
      showAlert('Error', 'Failed to process garment image: ' + error.message);
      console.error('Garment image error:', error);
    }
  };

  if (showPreScanForm) {
    return (
      <View style={styles.preScanModalScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <SafeAreaView style={styles.formContainer}>
          <View style={styles.formContent}>
            <TouchableOpacity
              onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs', { screen: 'Home' })}
              style={styles.formCloseButton}
            >
              <View style={styles.backRow}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
                <Text style={styles.closeButtonText}>Back</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Before You Scan</Text>
            <Text style={styles.formSubtitle}>
              Quick setup for better scan accuracy.
            </Text>

            <View style={styles.detailsCard}>
                <Text style={styles.inputLabel}>Brand Name</Text>
                <View style={styles.brandInputWrap}>
                  <Ionicons name="pricetag-outline" size={18} color={colors.textSecondary} />
                  <TextInput
                    style={styles.brandInput}
                    placeholder="e.g., Zara, H&M, Penneys"
                    placeholderTextColor={colors.textSecondary}
                    value={brandName}
                    onChangeText={setBrandName}
                    autoCapitalize="words"
                  />
                </View>

                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.genderSelector}>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      selectedGender === 'mens' && styles.genderButtonActive,
                    ]}
                    onPress={() => setSelectedGender('mens')}
                  >
                    <Text style={[
                      styles.genderButtonText,
                      selectedGender === 'mens' && styles.genderButtonTextActive,
                    ]}>
                      <Ionicons name="man-outline" size={16} color={selectedGender === 'mens' ? colors.primary : colors.textSecondary} /> Men's
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.genderButton,
                      selectedGender === 'womens' && styles.genderButtonActive,
                    ]}
                    onPress={() => setSelectedGender('womens')}
                  >
                    <Text style={[
                      styles.genderButtonText,
                      selectedGender === 'womens' && styles.genderButtonTextActive,
                    ]}>
                      <Ionicons name="woman-outline" size={16} color={selectedGender === 'womens' ? colors.primary : colors.textSecondary} /> Women's
                    </Text>
                  </TouchableOpacity>
                </View>

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

                <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Item Type</Text>
                <TouchableOpacity
                  style={styles.itemTypePickerButton}
                  onPress={() => setShowItemTypeModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select item type"
                >
                  <View style={styles.itemTypePickerLeft}>
                    <Ionicons
                      name={getCategoryIcon(selectedItemType?.category || 'general')}
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.itemTypePickerText}>
                      {selectedItemType?.name || 'Select item type'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                {selectedItemType?.weight ? (
                  <Text style={styles.itemTypeHint}>Estimated weight: ~{selectedItemType.weight}g</Text>
                ) : null}
            </View>

            <View style={styles.formActions}>
              <Button
                title="Start Scanning"
                onPress={handleStartScanning}
                style={styles.startButton}
              />

              <Button
                title="Upload Image from Gallery"
                onPress={handlePickImage}
                variant="secondary"
                style={styles.uploadButton}
              />
            </View>
          </View>

          <ItemTypePickerModal
            visible={showItemTypeModal}
            selectedType={selectedItemType?.name}
            onSelect={(item) => {
              setSelectedItemType(item);
              setShowItemTypeModal(false);
            }}
            onClose={() => setShowItemTypeModal(false)}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        <SafeAreaView style={styles.overlay}>
          <TouchableOpacity
            onPress={() => {
              if (scanStep === 'garment') {
                // go back to label step instead of leaving
                setScanStep('label');
                setLabelScanData(null);
              } else {
                // CameraScreen is a tab root, so goBack may not be available
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  setShowPreScanForm(true);
                }
              }
            }}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, scanStep === 'label' && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, scanStep === 'garment' && styles.stepDotActive]} />
            <Text style={styles.stepLabel}>
              {scanStep === 'label' ? 'Step 1: Scan Label' : 'Step 2: Photo of Item'}
            </Text>
          </View>

          <View style={styles.scanningArea}>
            <View style={styles.scanGuideBox}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.guideText}>
              {scanStep === 'label'
                ? 'Position care/composition label within frame'
                : 'Position the full garment within frame'}
            </Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={handlePickImage}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Pick from gallery"
            >
              <Ionicons name="images-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              accessibilityState={{ disabled: loading }}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <View style={{ width: 60 }} />
            {loading && <Text style={styles.processingText}>Processing...</Text>}
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  permissionText: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    color: colors.textSecondary,
  },
  backButton: {
    marginTop: spacing.md,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  scanGuideBox: {
    width: 280,
    height: 200,
    position: 'relative',
    marginBottom: spacing.lg,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: borderRadius.md,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: borderRadius.md,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: borderRadius.md,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: borderRadius.md,
  },
  guideText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  controls: {
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  galleryButton: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: '#FFFFFF',
  },
  processingText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    marginTop: spacing.sm,
  },
  formContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  preScanModalScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  formContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  formCloseButton: {
    marginBottom: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  closeButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  formTitle: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  // Step indicator on camera view
  stepIndicator: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    left: spacing.md + 56,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepLine: {
    width: 30,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: spacing.xs,
  },
  stepLabel: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: spacing.sm,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.text,
  },
  brandInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  brandInput: {
    ...typography.body,
    flex: 1,
    minHeight: 44,
    color: colors.textPrimary,
  },
  genderSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
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
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  genderButtonTextActive: {
    color: colors.primary,
  },
  secondHandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
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
  itemTypePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    backgroundColor: colors.surfaceSecondary,
  },
  itemTypePickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemTypePickerText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  itemTypeHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  formActions: {
    marginTop: 'auto',
    paddingTop: spacing.sm,
  },
  startButton: {
    marginTop: spacing.sm,
  },
  uploadButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  itemTypeButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    minHeight: 70,
    justifyContent: 'center',
  },
  selectedItemType: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primaryLight,
  },
  itemTypeName: {
    ...typography.bodySmall,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedItemText: {
    color: colors.primary,
  },
  itemTypeWeight: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  orDivider: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    marginVertical: spacing.md,
    fontWeight: '600',
  },
});

export default CameraScreen;


