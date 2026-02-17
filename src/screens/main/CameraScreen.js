// author: caitriona mccann
// date: 27/11/2025
// camera screen that asks for brand and item type first, then lets you scan the label
// connects to google vision api to read the text from clothing labels

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, FlatList, ScrollView } from 'react-native';
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

const CameraScreen = () => {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [showPreScanForm, setShowPreScanForm] = useState(true);
  const [brandName, setBrandName] = useState('');
  const [selectedItemType, setSelectedItemType] = useState(null);
  const [scanMode, setScanMode] = useState('sustainability'); // 'sustainability' or 'care'
  const cameraRef = useRef(null);

  // start scanning after user makes selection
  const handleStartScanning = () => {
    if (scanMode === 'care') {
      // care instructions scan doesn't need brand/item type
      setShowPreScanForm(false);
      return;
    }

    // sustainability scan requires brand and item type
    if (!brandName.trim()) {
      Alert.alert('Required', 'Please enter the brand name');
      return;
    }
    if (!selectedItemType) {
      Alert.alert('Required', 'Please select an item type');
      return;
    }
    setShowPreScanForm(false);
  };

  // pick image from gallery
  const handlePickImage = async () => {
    if (scanMode === 'care') {
      // care instructions scan doesn't need brand/item type
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

    // sustainability scan requires brand and item type
    if (!brandName.trim()) {
      Alert.alert('Required', 'Please enter the brand name');
      return;
    }
    if (!selectedItemType) {
      Alert.alert('Required', 'Please select an item type');
      return;
    }

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
        await processImage(imageUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error('Image picker error:', error);
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
            onPress={() => navigation.goBack()}
            variant="secondary"
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // capture photo and process with hybrid OCR (Vision API online, ML Kit offline)
  const handleCapture = async () => {
    if (!cameraRef.current || loading) return;

    try {
      setLoading(true);
      // take photo and save to file system
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (scanMode === 'care') {
        await processCareInstructionsImage(photo.uri);
      } else {
        await processImage(photo.uri);
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

  // shared image processing logic for camera and gallery (sustainability scan)
  const processImage = async (imageUri) => {
    try {
      // upload image to Firebase Storage first
      console.log('Uploading image to Firebase Storage...');
      let uploadResult = { success: false };
      try {
        uploadResult = await uploadScanImages(imageUri, Date.now().toString());
        if (!uploadResult.success) {
          console.warn('Image upload failed:', uploadResult.error);
        }
      } catch (uploadErr) {
        console.warn('Image upload error:', uploadErr.message);
      }

      // process with hybrid OCR (automatically picks best method)
      const ocrResult = await processImageHybrid(imageUri);

      console.log(`Scan processed with: ${ocrResult.method}`);
      const mlKitResult = ocrResult;
      
      // check if ML Kit failed
      if (!mlKitResult.success) {
        setLoading(false);
        Alert.alert(
          'Scan Failed',
          mlKitResult.error || 'Could not detect text from the label. Would you like to try again or enter details manually?',
          [
            { text: 'Try Again', style: 'default' },
            {
              text: 'Manual Input',
              onPress: () => {
                navigation.replace('ManualInput');
              },
            },
          ]
        );
        return;
      }

      // check if fibers were detected from the label
      if (!mlKitResult.data.fibers || mlKitResult.data.fibers.length === 0) {
        setLoading(false);
        Alert.alert(
          'No Fiber Information Detected',
          'We couldn\'t detect fiber composition from this label. Would you like to try scanning again or enter the details manually?',
          [
            { text: 'Try Again', style: 'default' },
            {
              text: 'Manual Input',
              onPress: () => {
                navigation.replace('ManualInput');
              },
            },
          ]
        );
        return;
      }

      // combine ML Kit data with pre-scan form data
      const scanData = {
        ...mlKitResult.data,
        brand: brandName.trim(),
        itemType: selectedItemType.name,
        itemWeightGrams: selectedItemType.weight,
        imageUrl: uploadResult.success ? uploadResult.imageUrl : null,
        thumbnailUrl: uploadResult.success ? uploadResult.thumbnailUrl : null,
      };

      // save to backend
      const saveResult = await saveScanToBackend(scanData);

      // if backend didn't return calculations (guest user or backend failure), calculate on frontend
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

      // navigate to results with backend-calculated data
      navigation.navigate('ScanResult', {
        scanData: finalScanData,
        scanId: saveResult.scanId,
      });

      setLoading(false);
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to capture image: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        <SafeAreaView style={styles.overlay}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <Text style={styles.closeText}>X</Text>
          </TouchableOpacity>

          <View style={styles.scanningArea}>
            <View style={styles.scanGuideBox}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.guideText}>Position care label within frame</Text>
          </View>

          <View style={styles.controls}>
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
              onPress={() => navigation.goBack()}
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
                  scanMode === 'sustainability' && styles.modeButtonActive,
                ]}
                onPress={() => setScanMode('sustainability')}
              >
                <Text style={[
                  styles.modeButtonText,
                  scanMode === 'sustainability' && styles.modeButtonTextActive,
                ]}>
                  Sustainability Impact
                </Text>
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
                  Care Instructions
                </Text>
              </TouchableOpacity>
            </View>

            {scanMode === 'sustainability' ? (
              <>
                <Text style={styles.inputLabel}>Brand Name</Text>
                <TextInput
                  style={styles.brandInput}
                  placeholder="e.g., Zara, H&M, Penneys"
                  placeholderTextColor={colors.textSecondary}
                  value={brandName}
                  onChangeText={setBrandName}
                  autoCapitalize="words"
                />

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
  startButton: {
    marginTop: spacing.lg,
  },
});

export default CameraScreen;


