// author: caitriona mccann
// date: 27/11/2025
// shows the results after scanning - environmental grade, fibers, water and co2 impact
// you can edit the brand and item type here if the vision api got it wrong

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import GradeIndicator from '../../components/GradeIndicator';
import ItemTypePickerModal from '../../components/ItemTypePickerModal';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { deleteScan, saveScanToBackend } from '../../services/api';
import { ITEM_TYPES } from '../../constants/itemTypes';

const ScanResultScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { scanData, scanId } = route.params || {};
  
  const [selectedItemType, setSelectedItemType] = useState(scanData?.itemType || scanData?.item_type || 'Garment');
  const [showItemTypeModal, setShowItemTypeModal] = useState(false);
  const [updatedScanData, setUpdatedScanData] = useState(scanData);
  const [brandName, setBrandName] = useState(scanData?.brand || '');
  
  // update scan data when route params change
  useEffect(() => {
    if (scanData) {
      console.log('ScanResultScreen received scanData:', JSON.stringify(scanData, null, 2));
      setUpdatedScanData(scanData);
    }
  }, [scanData]);

  // handle item type selection and recalculate impact
  const handleItemTypeSelect = async (itemType) => {
    setSelectedItemType(itemType.name);
    setShowItemTypeModal(false);
    
    // Recalculate with new item type
    const newScanData = {
      ...updatedScanData,
      itemType: itemType.name,
      brand: brandName || updatedScanData.brand,
    };
    
    // Save updated scan to backend to recalculate environmental impact
    const result = await saveScanToBackend(newScanData);
    
    if (result.success && result.scan) {
      setUpdatedScanData(result.scan);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Scan',
      'Are you sure you want to delete this scan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (scanId) {
              const result = await deleteScan(scanId);
              if (result.success) {
                navigation.navigate('History');
              } else {
                Alert.alert('Error', result.error || 'Failed to delete scan');
              }
            } else {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const {
    grade = 'C',
    score = 65,
    brand = 'Unknown',
    itemType = 'Garment',
    item_type,
    madeIn,
    fibers = [],
    water_usage_liters,
    carbon_footprint_kg,
    item_weight_grams,
  } = updatedScanData || {};

  // Use item_type from database or itemType, update selectedItemType on load
  const displayItemType = item_type || itemType || selectedItemType;
  
  useEffect(() => {
    if (item_type || itemType) {
      setSelectedItemType(item_type || itemType);
    }
  }, [item_type, itemType]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Home</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Scan Results</Text>

        <Card style={styles.gradeCard}>
          <View style={styles.gradeContainer}>
            <GradeIndicator grade={grade} />
            <View style={styles.gradeInfo}>
              <Text style={styles.gradeLabel}>Environmental Impact</Text>
              <Text style={styles.scoreText}>{score}/100</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.detailsCard}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Brand</Text>
            <Text style={styles.value}>{brand}</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity 
            style={styles.infoRow}
            onPress={() => setShowItemTypeModal(true)}
          >
            <Text style={styles.label}>Item Type</Text>
            <View style={styles.selectableValue}>
              <Text style={styles.value}>{displayItemType}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </View>
          </TouchableOpacity>
          {madeIn && madeIn !== 'Undetected' && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Made in</Text>
                <Text style={styles.value}>{madeIn}</Text>
              </View>
            </>
          )}
          {item_weight_grams && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Est. Weight</Text>
                <Text style={styles.value}>{item_weight_grams}g</Text>
              </View>
            </>
          )}
        </Card>

        <Card style={styles.metricsCard}>
          <Text style={styles.sectionTitle}>Environmental Metrics</Text>
          {water_usage_liters != null && typeof water_usage_liters === 'number' ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Water Usage</Text>
              <Text style={styles.value}>{water_usage_liters.toFixed(1)}L</Text>
            </View>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Water Usage</Text>
              <Text style={styles.value}>Calculating...</Text>
            </View>
          )}
          <View style={styles.divider} />
          {carbon_footprint_kg != null && typeof carbon_footprint_kg === 'number' ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Carbon Footprint</Text>
              <Text style={styles.value}>{carbon_footprint_kg.toFixed(2)} kg CO₂</Text>
            </View>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Carbon Footprint</Text>
              <Text style={styles.value}>Calculating...</Text>
            </View>
          )}
        </Card>

        <Card style={styles.fibersCard}>
          <Text style={styles.sectionTitle}>Fiber Composition</Text>
          {fibers.length > 0 ? (
            fibers.map((fiber, index) => (
              <View key={index} style={styles.fiberRow}>
                <Text style={styles.fiberName}>{fiber.name}</Text>
                <Text style={styles.fiberPercent}>{fiber.percentage}%</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No fiber data available</Text>
          )}
        </Card>

        <View style={styles.actions}>
          <Button
            title="View Breakdown"
            onPress={() => navigation.navigate('Breakdown', { scanData: updatedScanData, scanId })}
          />
          <Button
            title="Edit Details"
            onPress={() => navigation.navigate('EditScan', { scanData: updatedScanData, scanId })}
            variant="secondary"
            style={styles.editButton}
          />
          {scanId && (
            <Button
              title="Delete Scan"
              onPress={handleDelete}
              variant="secondary"
              style={styles.deleteButton}
            />
          )}
        </View>
      </ScrollView>

      {/* reusable item type picker modal */}
      <ItemTypePickerModal
        visible={showItemTypeModal}
        onClose={() => setShowItemTypeModal(false)}
        onSelect={handleItemTypeSelect}
        selectedType={selectedItemType}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
    marginBottom: spacing.lg,
  },
  gradeCard: {
    marginBottom: spacing.md,
  },
  detailsCard: {
    marginBottom: spacing.md,
  },
  metricsCard: {
    marginBottom: spacing.md,
  },
  fibersCard: {
    marginBottom: spacing.md,
  },
  gradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradeInfo: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  gradeLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  scoreText: {
    ...typography.h2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
  },
  value: {
    ...typography.body,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  fiberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  fiberName: {
    ...typography.body,
  },
  fiberPercent: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  actions: {
    marginTop: spacing.lg,
  },
  editButton: {
    marginTop: spacing.sm,
  },
  deleteButton: {
    marginTop: spacing.sm,
    backgroundColor: '#C0826D',
  },
  selectableValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dropdownArrow: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default ScanResultScreen;


