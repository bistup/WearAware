// author: caitriona mccann
// date: 27/11/2025
// lets you edit scan details if something went wrong
// can change brand, item type, and fiber percentages

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { colors, typography, spacing } from '../../theme/theme';
import { updateScan } from '../../services/api';

const EditScanScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { scanData, scanId } = route.params || {};

  const [brand, setBrand] = useState(scanData?.brand || '');
  const [itemType, setItemType] = useState(scanData?.itemType || '');
  const [fibers, setFibers] = useState(scanData?.fibers || []);
  const [loading, setLoading] = useState(false);

  const handleAddFiber = () => {
    setFibers([...fibers, { name: '', percentage: '' }]);
  };

  const handleRemoveFiber = (index) => {
    const newFibers = fibers.filter((_, i) => i !== index);
    setFibers(newFibers);
  };

  const handleFiberChange = (index, field, value) => {
    const newFibers = [...fibers];
    newFibers[index][field] = value;
    setFibers(newFibers);
  };

  const styles = getStyles(colors, typography, spacing);

  const handleSave = async () => {
    // Validate percentages
    const total = fibers.reduce((sum, f) => sum + (parseFloat(f.percentage) || 0), 0);
    if (total !== 100) {
      Alert.alert('Validation Error', 'Fiber percentages must total 100%');
      return;
    }

    setLoading(true);
    const updatedData = {
      brand,
      itemType,
      fibers: fibers.map(f => ({
        name: f.name,
        percentage: parseFloat(f.percentage),
      })),
    };

    const result = await updateScan(scanId, updatedData);
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Scan updated successfully', [
        { 
          text: 'OK', 
          onPress: () => navigation.navigate('ScanResult', { 
            scanData: result.scan, 
            scanId 
          })
        },
      ]);
    } else {
      Alert.alert('Error', result.error || 'Failed to update scan');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Edit Scan</Text>

        <Input label="Brand" value={brand} onChangeText={setBrand} placeholder="Brand name" />

        <Input
          label="Item Type"
          value={itemType}
          onChangeText={setItemType}
          placeholder="e.g., T-shirt, Jeans"
        />

        <Text style={styles.sectionTitle}>Fiber Composition</Text>

        {fibers.map((fiber, index) => (
          <View key={index} style={styles.fiberRow}>
            <Input
              label="Fiber Name"
              value={fiber.name}
              onChangeText={(value) => handleFiberChange(index, 'name', value)}
              placeholder="e.g., Cotton"
              style={styles.fiberInput}
            />
            <Input
              label="Percentage"
              value={fiber.percentage.toString()}
              onChangeText={(value) => handleFiberChange(index, 'percentage', value)}
              placeholder="%"
              keyboardType="numeric"
              style={styles.percentInput}
            />
            <TouchableOpacity
              onPress={() => handleRemoveFiber(index)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Button
          title="+ Add Fiber"
          onPress={handleAddFiber}
          variant="secondary"
          style={styles.addButton}
        />

        <Button title="Save Changes" onPress={handleSave} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (colors, typography, spacing) => StyleSheet.create({
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
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  fiberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  fiberInput: {
    flex: 1,
    marginRight: spacing.sm,
  },
  percentInput: {
    width: 80,
    marginRight: spacing.sm,
  },
  removeButton: {
    width: 40,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  removeText: {
    fontSize: 20,
    color: colors.error,
  },
  addButton: {
    marginBottom: spacing.lg,
  },
});

export default EditScanScreen;


