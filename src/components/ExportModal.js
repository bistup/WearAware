// author: caitriona mccann
// date: 30/01/2026
// last updated: 05/02/2026
// modal component for exporting sustainability reports as CSV, PDF or TXT
// compatible with Expo Go - supports selective or all scan export

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  FlatList,
} from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';
import { getGradeColor } from '../theme/theme';
import { exportAsCSV, exportAsText, exportAsPDF, generateStatistics } from '../services/exportService';

const ExportModal = ({ visible, scans, selectedScans: initialSelected = [], onClose }) => {
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState('all'); // 'all' or 'selected'
  const [selectedItems, setSelectedItems] = useState([]);

  // reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedItems(initialSelected);
      setExportMode(initialSelected.length > 0 ? 'selected' : 'all');
    }
  }, [visible, initialSelected]);

  const scansToExport = exportMode === 'all' ? scans : selectedItems;

  const handleToggleItem = (scan) => {
    if (selectedItems.find(s => s.id === scan.id)) {
      setSelectedItems(selectedItems.filter(s => s.id !== scan.id));
    } else {
      setSelectedItems([...selectedItems, scan]);
    }
  };

  const handleSelectAll = () => {
    setSelectedItems([...scans]);
  };

  const handleDeselectAll = () => {
    setSelectedItems([]);
  };

  const handleExportCSV = async () => {
    if (scansToExport.length === 0) {
      Alert.alert('No Items', 'Please select at least one scan to export');
      return;
    }
    setExporting(true);
    try {
      await exportAsCSV(scansToExport);
      Alert.alert('Success', `Exported ${scansToExport.length} scan(s) as CSV`);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to export CSV: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportText = async () => {
    if (scansToExport.length === 0) {
      Alert.alert('No Items', 'Please select at least one scan to export');
      return;
    }
    setExporting(true);
    try {
      await exportAsText(scansToExport);
      Alert.alert('Success', `Exported ${scansToExport.length} scan(s) as TXT`);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to export report: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (scansToExport.length === 0) {
      Alert.alert('No Items', 'Please select at least one scan to export');
      return;
    }
    setExporting(true);
    try {
      await exportAsPDF(scansToExport);
      Alert.alert('Success', `Exported ${scansToExport.length} scan(s) as PDF`);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to export PDF: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const stats = generateStatistics(scansToExport);

  const renderScanItem = ({ item }) => {
    const isSelected = selectedItems.find(s => s.id === item.id);
    return (
      <TouchableOpacity
        style={[styles.scanItem, isSelected && styles.scanItemSelected]}
        onPress={() => handleToggleItem(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>[x]</Text>}
        </View>
        <View style={styles.scanItemInfo}>
          <Text style={styles.scanItemBrand} numberOfLines={1}>
            {item.brand || 'Unknown Brand'}
          </Text>
          <Text style={styles.scanItemMeta}>
            {item.itemType || 'Garment'} • Grade {item.grade || 'C'}
          </Text>
        </View>
        <Text style={styles.scanItemDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Export Report</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close export modal"
            >
              <Text style={styles.closeText}>X</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Export Mode Toggle */}
            <View style={styles.modeContainer}>
              <TouchableOpacity
                style={[styles.modeButton, exportMode === 'all' && styles.modeButtonActive]}
                onPress={() => setExportMode('all')}
              >
                <Text style={[styles.modeText, exportMode === 'all' && styles.modeTextActive]}>
                  All Scans ({scans.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, exportMode === 'selected' && styles.modeButtonActive]}
                onPress={() => setExportMode('selected')}
              >
                <Text style={[styles.modeText, exportMode === 'selected' && styles.modeTextActive]}>
                  Selected ({selectedItems.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Selection List (only shown in selected mode) */}
            {exportMode === 'selected' && (
              <View style={styles.selectionContainer}>
                <View style={styles.selectionHeader}>
                  <Text style={styles.selectionLabel}>Select Scans to Export</Text>
                  <View style={styles.selectionActions}>
                    <TouchableOpacity onPress={handleSelectAll} style={styles.selectAction}>
                      <Text style={styles.selectActionText}>All</Text>
                    </TouchableOpacity>
                    <Text style={styles.actionDivider}>|</Text>
                    <TouchableOpacity onPress={handleDeselectAll} style={styles.selectAction}>
                      <Text style={styles.selectActionText}>None</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.scanList}>
                  {scans.map((item) => (
                    <View key={item.id}>
                      {renderScanItem({ item })}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Stats Preview */}
            <View style={styles.statsContainer}>
              <Text style={styles.statsLabel}>
                {exportMode === 'all' ? 'Full Report Summary' : `Summary (${selectedItems.length} items)`}
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.totalScans}</Text>
                  <Text style={styles.statLabel}>Total Scans</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.averageGrade}</Text>
                  <Text style={styles.statLabel}>Avg Grade</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.totalWater}L</Text>
                  <Text style={styles.statLabel}>Water Used</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.totalCarbon}kg</Text>
                  <Text style={styles.statLabel}>Carbon</Text>
                </View>
              </View>

              <View style={styles.gradeDistribution}>
                <Text style={styles.distLabel}>Grade Distribution</Text>
                <View style={styles.gradeRow}>
                  {Object.entries(stats.gradeDistribution).map(([grade, count]) => (
                    <View key={grade} style={styles.gradeItem}>
                      <Text style={[styles.gradeLetter, { color: getGradeColor(grade) }]}>
                        {grade}
                      </Text>
                      <Text style={styles.gradeCount}>{count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.optionsContainer}>
              <Text style={styles.optionsLabel}>Choose Export Format</Text>

              <TouchableOpacity
                style={[styles.exportButton, styles.pdfButton, scansToExport.length === 0 && styles.disabledButton]}
                onPress={handleExportPDF}
                disabled={exporting || scansToExport.length === 0}
              >
                {exporting ? (
                  <ActivityIndicator color={'#FFFFFF'} />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonTitle}>Export as PDF</Text>
                    <Text style={styles.buttonDescription}>
                      Human-readable report with full breakdown
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportButton, styles.csvButton, scansToExport.length === 0 && styles.disabledButton]}
                onPress={handleExportCSV}
                disabled={exporting || scansToExport.length === 0}
              >
                {exporting ? (
                  <ActivityIndicator color={'#FFFFFF'} />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonTitle}>Export as CSV</Text>
                    <Text style={styles.buttonDescription}>
                      Spreadsheet format with fiber-level data
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportButton, styles.textButton, scansToExport.length === 0 && styles.disabledButton]}
                onPress={handleExportText}
                disabled={exporting || scansToExport.length === 0}
              >
                {exporting ? (
                  <ActivityIndicator color={'#FFFFFF'} />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonTitle}>Export as Text</Text>
                    <Text style={styles.buttonDescription}>
                      Plain text for easy sharing
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={exporting}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingBottom: spacing.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
  },
  closeButton: {
    padding: spacing.sm,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  content: {
    maxHeight: 550,
  },
  // mode toggle styles
  modeContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  modeTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  // selection list styles
  selectionContainer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectionLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAction: {
    paddingHorizontal: spacing.sm,
  },
  selectActionText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  actionDivider: {
    color: colors.textSecondary,
  },
  scanList: {
    maxHeight: 180,
  },
  scanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  scanItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scanItemInfo: {
    flex: 1,
  },
  scanItemBrand: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  scanItemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scanItemDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  // stats styles
  statsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    marginTop: spacing.md,
  },
  statsLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
    color: colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  gradeDistribution: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  distLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
  },
  gradeItem: {
    alignItems: 'center',
  },
  gradeLetter: {
    ...typography.h3,
    fontWeight: '700',
  },
  gradeCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  optionsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  optionsLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.lg,
    color: colors.text,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  pdfButton: {
    backgroundColor: colors.error,
  },
  csvButton: {
    backgroundColor: colors.primary,
  },
  textButton: {
    backgroundColor: colors.primaryDark,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonContent: {
    flex: 1,
  },
  buttonTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  buttonDescription: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  cancelButton: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  cancelText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default ExportModal;
