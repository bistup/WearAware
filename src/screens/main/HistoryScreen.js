// author: caitriona mccann
// date: 27/11/2025
// shows all your previous scans with their grades
// loads from backend if logged in, otherwise uses local storage for guest mode

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Card from '../../components/Card';
import Button from '../../components/Button';
import GradeIndicator from '../../components/GradeIndicator';
import ExportModal from '../../components/ExportModal';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/theme';
import { fetchScanHistory, deleteScan } from '../../services/api';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';

const HistoryScreen = () => {
  const navigation = useNavigation();
  const { isGuest, user } = useAuth();
  const { showAlert } = useAlert();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedScans, setSelectedScans] = useState([]);

  const styles = getStyles(colors, typography, spacing);

  useFocusEffect(
    React.useCallback(() => {
      if (!isGuest) {
        loadHistory();
      } else {
        setLoading(false);
      }
    }, [isGuest])
  );

  const loadHistory = async () => {
    setLoading(true);
    
    // only load for registered users
    const result = await fetchScanHistory();
    if (result.success) {
      setScans(result.scans);
    }
    
    setLoading(false);
  };

  const handleDeleteScan = (scanId, brand) => {
    showAlert(
      'Delete Scan',
      `Are you sure you want to delete the scan for ${brand || 'this item'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteScan(scanId);
            if (result.success) {
              setScans(scans.filter(scan => scan.id !== scanId));
            } else {
              showAlert('Error', result.error || 'Failed to delete scan');
            }
          },
        },
      ]
    );
  };

  const handleToggleComparison = () => {
    setComparisonMode(!comparisonMode);
    setSelectedScans([]);
  };

  const handleSelectScan = (scan) => {
    if (selectedScans.find(s => s.id === scan.id)) {
      setSelectedScans(selectedScans.filter(s => s.id !== scan.id));
    } else if (selectedScans.length < 2) {
      setSelectedScans([...selectedScans, scan]);
    } else {
      showAlert('Limit Reached', 'You can only compare 2 items at a time');
    }
  };

  const handleCompare = () => {
    if (selectedScans.length !== 2) {
      showAlert('Selection Required', 'Please select exactly 2 items to compare');
      return;
    }
    navigation.navigate('Comparison', { scans: selectedScans });
    // reset state for when user returns
    setComparisonMode(false);
    setSelectedScans([]);
  };

  const renderScanItem = ({ item }) => {
    const isSelected = comparisonMode && selectedScans.find(s => s.id === item.id);
    const hasImage = !!(item.thumbnailUrl || item.thumbnail_url || item.imageUrl || item.image_url);
    const imageUri = item.thumbnailUrl || item.thumbnail_url || item.imageUrl || item.image_url;

    return (
      <TouchableOpacity
        onPress={() => {
          if (comparisonMode) {
            handleSelectScan(item);
          } else {
            navigation.navigate('ScanResult', {
              scanData: item,
              scanId: item.id
            });
          }
        }}
        activeOpacity={0.7}
        style={[styles.scanCard, isSelected && styles.selectedCard]}
        accessibilityRole="button"
        accessibilityLabel={`${item.brand || 'Unknown Brand'} ${item.itemType || 'Garment'}, grade ${item.grade || 'C'}`}
        accessibilityHint={comparisonMode ? 'Select this item for comparison' : 'View scan details'}
      >
        <View style={styles.scanRow}>
          {/* Thumbnail or grade circle */}
          {hasImage ? (
            <View style={styles.thumbnailContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={styles.gradeCircle}>
              <GradeIndicator grade={item.grade || 'C'} size="small" />
            </View>
          )}

          {/* Info */}
          <View style={styles.scanInfo}>
            <Text style={styles.brand} numberOfLines={1}>{item.brand || 'Unknown Brand'}</Text>
            <Text style={styles.itemType} numberOfLines={1}>{item.itemType || 'Garment'}</Text>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {/* Right side: grade (if image shown) + actions */}
          <View style={styles.scanRight}>
            {hasImage && <GradeIndicator grade={item.grade || 'C'} size="small" />}
            {comparisonMode ? (
              <View
                style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`Select ${item.brand || 'scan'} for comparison`}
              >
                {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
            ) : (
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation?.();
                  handleDeleteScan(item.id, item.brand);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Delete scan for ${item.brand || 'this item'}`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleSignUp = async () => {
    // logout guest user, which will show auth screens
    await signOut(auth);
  };

  const renderGuestPrompt = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>History Not Available</Text>
      <Text style={styles.emptySubtext}>
        Sign up for an account to save and view your scan history across devices
      </Text>
      <Button
        title="Sign Up"
        onPress={handleSignUp}
        style={styles.signUpButton}
      />
      <Button
        title="Go Back"
        onPress={() => navigation.goBack()}
        variant="secondary"
        style={styles.backButton}
      />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No scans yet</Text>
      <Text style={styles.emptySubtext}>
        Start scanning clothing labels to see your history
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan History</Text>
        {!isGuest && scans.length > 0 && (
          <View style={styles.headerActions}>
            {!comparisonMode ? (
              <>
                <TouchableOpacity
                  onPress={() => setExportModalVisible(true)}
                  style={styles.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel="Export scan history"
                >
                  <Ionicons name="download-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleToggleComparison}
                  style={styles.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel="Compare scans"
                >
                  <Ionicons name="git-compare-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={handleToggleComparison}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Exit comparison mode"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {comparisonMode && (
        <View style={styles.comparisonBar}>
          <Text style={styles.comparisonText}>
            Select 2 items to compare ({selectedScans.length}/2)
          </Text>
          {selectedScans.length === 2 && (
            <TouchableOpacity
              onPress={handleCompare}
              style={styles.compareNowButton}
              accessibilityRole="button"
              accessibilityLabel="Compare selected items"
            >
              <Text style={styles.compareNowText}>Compare Now</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isGuest ? (
        renderGuestPrompt()
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={scans}
          renderItem={renderScanItem}
          keyExtractor={(item, index) => item.id || index.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          accessibilityLabel="Scan history list"
        />
      )}

      <ExportModal
        visible={exportModalVisible}
        scans={scans}
        selectedScans={selectedScans}
        onClose={() => setExportModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const getStyles = (colors, typography, spacing) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  title: {
    ...typography.h1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonBar: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparisonText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  compareNowButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
  },
  compareNowText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  scanCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  gradeCircle: {
    marginRight: spacing.md,
  },
  scanInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  scanRight: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  brand: {
    ...typography.body,
    fontWeight: '600',
  },
  itemType: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  date: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
  },
  emptyText: {
    ...typography.h3,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  signUpButton: {
    width: '100%',
    marginBottom: spacing.md,
  },
  backButton: {
    width: '100%',
  },
});

export default HistoryScreen;


