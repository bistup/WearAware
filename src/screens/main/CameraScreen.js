// author: caitriona mccann
// date: 27/11/2025
// camera screen that asks for brand and item type first, then lets you scan the label
// connects to google vision api to read the text from clothing labels

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, FlatList, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { processImageWithVision } from '../../services/visionApi';
import { saveScanToBackend } from '../../services/api';
import { ITEM_TYPES } from '../../constants/itemTypes';

const CameraScreen = () => {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [showPreScanForm, setShowPreScanForm] = useState(true);
  const [brandName, setBrandName] = useState('');
  const [selectedItemType, setSelectedItemType] = useState(null);
  const cameraRef = useRef(null);

  // start scanning after user enters brand and item type
  const handleStartScanning = () => {
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

  // capture photo and send to vision api
  const handleCapture = async () => {
    if (!cameraRef.current || loading) return;

    try {
      setLoading(true);
      // take photo with base64 encoding
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      // send to google vision api for text extraction
      const visionResult = await processImageWithVision(photo.base64);
      
      // check if vision api failed
      if (!visionResult.success) {
        setLoading(false);
        Alert.alert(
          'Scan Failed',
          visionResult.error || 'Could not detect text from the label. Would you like to try again or enter details manually?',
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
      if (!visionResult.data.fibers || visionResult.data.fibers.length === 0) {
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

      // combine vision data with pre-scan form data
      const scanData = {
        ...visionResult.data,
        brand: brandName.trim(),
        itemType: selectedItemType.name,
        itemWeightGrams: selectedItemType.weight,
      };

      // save to backend
      const saveResult = await saveScanToBackend(scanData);

      // Navigate to results with backend-calculated data
      navigation.navigate('ScanResult', {
        scanData: saveResult.scan || scanData,
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
          >
            <Text style={styles.closeText}>✕</Text>
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
              Please provide item details for accurate environmental impact calculation
            </Text>

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

            <Button
              title="Start Scanning"
              onPress={handleStartScanning}
              style={styles.startButton}
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
    backgroundColor: colors.textPrimary,
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 24,
    color: colors.surface,
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
    borderColor: colors.surface,
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
    color: colors.surface,
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  processingText: {
    ...typography.bodySmall,
    color: colors.surface,
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
    marginBottom: spacing.xl,
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
    backgroundColor: colors.primary + '10',
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
});

export default CameraScreen;


