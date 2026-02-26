// author: caitriona mccann
// date: 27/11/2025
// camera screen that asks for brand and item type first, then lets you scan the label
// connects to google vision api to read the text from clothing labels

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, FlatList, ScrollView, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { processImageHybrid } from '../../services/hybridOcr';
import { saveScanToBackend } from '../../services/api';
import { calculateImpactScore } from '../../utils/impactCalculator';
import { ITEM_TYPES } from '../../constants/constants';
import { uploadScanImages } from '../../services/imageUpload';
import { useAuth } from '../../context/AuthContext';

const CameraScreen = () => {
  const navigation = useNavigation();
  const { isGuest } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [showPreScanForm, setShowPreScanForm] = useState(true);
  const [brandName, setBrandName] = useState('');
  const [selectedItemType, setSelectedItemType] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null); // 'mens' or 'womens'
  const [scanMode, setScanMode] = useState('full'); // 'full' or 'care'
  const cameraRef = useRef(null);

  // two-step flow state for full scan
  const [scanStep, setScanStep] = useState('label'); // 'label' or 'garment'
  const [labelScanData, setLabelScanData] = useState(null); // stores OCR result from step 1

  // start scanning after user makes selection
  const handleStartScanning = () => {
    if (scanMode === 'care') {
      // care instructions scan doesn't need brand/item type
      setShowPreScanForm(false);
      return;
    }

    // full scan requires brand and item type
    if (!brandName.trim()) {
      Alert.alert('Required', 'Please enter the brand name');
      return;
    }
    if (!selectedItemType) {
      Alert.alert('Required', 'Please select an item type');
      return;
    }
    // start at step 1 (label scan)
    setScanStep('label');
    setLabelScanData(null);
    setShowPreScanForm(false);
  };

  // pick image from gallery
  const handlePickImage = async () => {
    if (scanMode === 'care') {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          setLoading(true);
          const imageUri = result.assets[0].uri;
          await processCareInstructionsImage(imageUri);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to pick image');
        console.error('Image picker error:', error);
      }
      return;
    }

    // full scan mode - validate brand/item type before proceeding
    if (showPreScanForm) {
      if (!brandName.trim()) {
        Alert.alert('Required', 'Please enter the brand name');
        return;
      }
      if (!selectedItemType) {
        Alert.alert('Required', 'Please select an item type');
        return;
      }
    }

    // full scan mode - depends on which step we're at
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
        Alert.alert('Error', 'Failed to pick image');
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
        Alert.alert('Error', 'Failed to pick image');
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
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
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

      if (scanMode === 'care') {
        await processCareInstructionsImage(photo.uri);
      } else if (scanStep === 'label') {
        // step 1: scan the label for fibers/OCR
        await processLabelImage(photo.uri);
      } else {
        // step 2: photograph the garment
        await processGarmentImage(photo.uri);
      }
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      console.error('Capture error:', error);
    }
  };

  // process image for care instructions only
  const processCareInstructionsImage = async (imageUri) => {
    try {
      const ocrResult = await processImageHybrid(imageUri);
      
      if (!ocrResult.success) {
        setLoading(false);
        Alert.alert('Scan Failed', ocrResult.error || 'Could not detect text from the label.');
        return;
      }

      const careInstructions = ocrResult.data.careInstructions || [];
      
      if (careInstructions.length === 0) {
        setLoading(false);
        Alert.alert(
          'No Care Instructions Detected',
          'We couldn\'t detect care instructions from this label. Try scanning a clearer image of the care symbols.'
        );
        return;
      }

      setLoading(false);
      navigation.navigate('CareInstructions', {
        careInstructions,
        rawText: ocrResult.data.rawText,
      });
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to process image');
      console.error('Care instructions processing error:', error);
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
        Alert.alert(
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
        Alert.alert(
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
      Alert.alert('Error', 'Failed to process label image: ' + error.message);
      console.error('Label scan error:', error);
    }
  };

  // =====================================================================
  // STEP 2: Process garment image (upload + save combined scan)
  // =====================================================================
  const processGarmentImage = async (imageUri) => {
    if (isGuest) {
      setLoading(false);
      Alert.alert('Sign In Required', 'Create an account to save scans. Image upload requires authentication.');
      return;
    }

    if (!labelScanData) {
      setLoading(false);
      Alert.alert('Missing Label Scan', 'Please scan the care label first before photographing the garment.');
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
      Alert.alert('Error', 'Failed to process garment image: ' + error.message);
      console.error('Garment image error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        <SafeAreaView style={styles.overlay}>
          <TouchableOpacity
            onPress={() => {
              if (scanMode === 'full' && scanStep === 'garment') {
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
            <Text style={styles.closeText}>X</Text>
          </TouchableOpacity>

          {/* Step indicator for full scan mode */}
          {scanMode === 'full' && (
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, scanStep === 'label' && styles.stepDotActive]} />
              <View style={styles.stepLine} />
              <View style={[styles.stepDot, scanStep === 'garment' && styles.stepDotActive]} />
              <Text style={styles.stepLabel}>
                {scanStep === 'label' ? 'Step 1: Scan Label' : 'Step 2: Photo of Item'}
              </Text>
            </View>
          )}

          <View style={styles.scanningArea}>
            <View style={styles.scanGuideBox}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.guideText}>
              {scanMode === 'care'
                ? 'Position care label within frame'
                : scanStep === 'label'
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
              <Text style={styles.galleryButtonText}>Gallery</Text>
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

      <Modal
        visible={showPreScanForm}
        transparent={false}
        animationType="slide"
      >
        <SafeAreaView style={styles.formContainer}>
          <ScrollView contentContainerStyle={styles.formContent}>
            <TouchableOpacity
              onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
              style={styles.formCloseButton}
            >
              <Text style={styles.closeButtonText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Before You Scan</Text>
            <Text style={styles.formSubtitle}>
              Choose what you want to scan
            </Text>

            {/* Scan Mode Selector */}
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  scanMode === 'full' && styles.modeButtonActive,
                ]}
                onPress={() => setScanMode('full')}
              >
                <Text style={[
                  styles.modeButtonText,
                  scanMode === 'full' && styles.modeButtonTextActive,
                ]}>
                  Full Scan
                </Text>
                <Text style={styles.modeSubtext}>Label + Item Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  scanMode === 'care' && styles.modeButtonActive,
                ]}
                onPress={() => setScanMode('care')}
              >
                <Text style={[
                  styles.modeButtonText,
                  scanMode === 'care' && styles.modeButtonTextActive,
                ]}>
                  Care Labels
                </Text>
                <Text style={styles.modeSubtext}>Washing Instructions</Text>
              </TouchableOpacity>
            </View>

            {scanMode === 'full' ? (
              <>
                {/* How it works explanation */}
                <View style={styles.howItWorks}>
                  <Text style={styles.howItWorksTitle}>How it works</Text>
                  <View style={styles.howItWorksStep}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.howItWorksText}>Scan the care label to detect fiber composition</Text>
                  </View>
                  <View style={styles.howItWorksStep}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.howItWorksText}>Take a photo of the garment for AI visual matching</Text>
                  </View>
                </View>

                <Text style={styles.inputLabel}>Brand Name</Text>
                <TextInput
                  style={styles.brandInput}
                  placeholder="e.g., Zara, H&M, Penneys"
                  placeholderTextColor={colors.textSecondary}
                  value={brandName}
                  onChangeText={setBrandName}
                  autoCapitalize="words"
                />

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
                      Men's
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
                      Women's
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Item Type</Text>
                <FlatList
                  data={ITEM_TYPES}
                  keyExtractor={(item) => item.name}
                  scrollEnabled={false}
                  numColumns={2}
                  columnWrapperStyle={styles.itemTypeRow}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.itemTypeButton,
                        selectedItemType?.name === item.name && styles.selectedItemType,
                      ]}
                      onPress={() => setSelectedItemType(item)}
                    >
                      <Text style={[
                        styles.itemTypeName,
                        selectedItemType?.name === item.name && styles.selectedItemText,
                      ]}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemTypeWeight}>~{item.weight}g</Text>
                      {selectedItemType?.name === item.name && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  )}
                />
              </>
            ) : (
              <View style={styles.careModeBanner}>
                <Text style={styles.careModeText}>
                  Scan your care label to see washing, drying, and ironing instructions
                </Text>
              </View>
            )}

            <Button
              title={scanMode === 'care' ? 'Scan Care Label' : 'Start Scanning'}
              onPress={handleStartScanning}
              style={styles.startButton}
            />
            
            <Text style={styles.orDivider}>OR</Text>
            
            <Button
              title="Upload Image from Gallery"
              onPress={handlePickImage}
              variant="secondary"
              style={styles.uploadButton}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  closeText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
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
  galleryButtonText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 10,
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
  formContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  formCloseButton: {
    marginBottom: spacing.lg,
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
    marginBottom: spacing.lg,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  modeButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  modeButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: colors.primary,
  },
  modeSubtext: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
    fontSize: 10,
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
  // How it works section
  howItWorks: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  howItWorksTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  howItWorksStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.background,
  },
  howItWorksText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  careModeBanner: {
    backgroundColor: colors.primaryLight,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  careModeText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.text,
  },
  brandInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
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
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  genderButtonTextActive: {
    color: colors.primary,
  },
  itemTypeRow: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
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
  checkmark: {
    fontSize: 16,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  startButton: {
    marginTop: spacing.lg,
  },
  orDivider: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    marginVertical: spacing.md,
    fontWeight: '600',
  },
  uploadButton: {
    marginBottom: spacing.md,
  },
});

export default CameraScreen;


