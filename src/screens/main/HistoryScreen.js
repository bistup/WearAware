// author: caitriona mccann
// date: 27/11/2025
// shows all your previous scans with their grades
// loads from backend if logged in, otherwise uses local storage for guest mode

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/Card';
import Button from '../../components/Button';
import GradeIndicator from '../../components/GradeIndicator';
import ExportModal from '../../components/ExportModal';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/theme';
import { fetchScanHistory, deleteScan } from '../../services/api';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';

const HistoryScreen = () => {
  const navigation = useNavigation();
  const { isGuest, user } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedScans, setSelectedScans] = useState([]);

  const styles = getStyles(colors, typography, spacing);

  useEffect(() => {
    if (!isGuest) {
      loadHistory();
    } else {
      setLoading(false);
    }
  }, [isGuest]);

  // reload history when screen comes back into focus (e.g., after comparison)
  useFocusEffect(
    React.useCallback(() => {
      if (!isGuest) {
        loadHistory();
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
    Alert.alert(
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
              Alert.alert('Error', result.error || 'Failed to delete scan');
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
      Alert.alert('Limit Reached', 'You can only compare 2 items at a time');
    }
  };

  const handleCompare = () => {
    if (selectedScans.length !== 2) {
      Alert.alert('Selection Required', 'Please select exactly 2 items to compare');
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
      <Card style={[styles.scanCard, isSelected && styles.selectedCard]}>
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
          style={styles.scanContent}
        >
          {/* Image banner at top of card */}
          {hasImage && (
            <View style={styles.cardImageContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <View style={styles.cardImageOverlay} />
              <View style={styles.cardGradeBadge}>
                <GradeIndicator grade={item.grade || 'C'} size="small" />
              </View>
              {comparisonMode && (
                <View style={styles.cardCheckboxOverlay}>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </View>
              )}
            </View>
          )}
          <View style={styles.scanHeader}>
            {!hasImage && comparisonMode && (
              <View style={styles.checkboxContainer}>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </View>
            )}
            <View style={styles.scanInfo}>
              <Text style={styles.brand}>{item.brand || 'Unknown Brand'}</Text>
              <Text style={styles.itemType}>{item.itemType || 'Garment'}</Text>
              <Text style={styles.date}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            {!hasImage && <GradeIndicator grade={item.grade || 'C'} size="small" />}
          </View>
        </TouchableOpacity>
        {!comparisonMode && (
          <TouchableOpacity
            onPress={() => handleDeleteScan(item.id, item.brand)}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </Card>
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
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Scan History</Text>
        </View>
        {!isGuest && scans.length > 0 && (
          <View style={styles.headerActions}>
            {!comparisonMode && (
              <>
                <TouchableOpacity
                  onPress={() => setExportModalVisible(true)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionText}>Export</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleToggleComparison}
                  style={[styles.actionButton, styles.compareButton]}
                >
                  <Text style={styles.actionText}>Compare</Text>
                </TouchableOpacity>
              </>
            )}
            {comparisonMode && (
              <TouchableOpacity
                onPress={handleToggleComparison}
                style={[styles.actionButton, styles.cancelButton]}
              >
                <Text style={styles.actionText}>Cancel</Text>
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
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    ...typography.h1,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    minWidth: 80,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareButton: {
    backgroundColor: colors.primaryDark,
  },
  cancelButton: {
    backgroundColor: colors.textSecondary,
  },
  actionText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  comparisonBar: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparisonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  compareNowButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.textPrimary,
    borderRadius: borderRadius.md,
  },
  compareNowText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontWeight: '600',
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
    marginBottom: spacing.md,
    overflow: 'hidden',
    padding: 0,
  },
  selectedCard: {
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSecondary,
  },
  scanContent: {
    flex: 1,
  },
  cardImageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
    backgroundColor: colors.surface,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  cardGradeBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  cardCheckboxOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  checkboxContainer: {
    marginRight: spacing.md,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
    backgroundColor: colors.surface,
  },
  checkbox: {
    width: 24,
    height: 24,
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
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: colors.error,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderRadius: borderRadius.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  deleteText: {
    color: '#FFFFFF',
    ...typography.bodySmall,
    fontWeight: '600',
  },
  scanInfo: {
    flex: 1,
  },
  brand: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  itemType: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  date: {
    ...typography.caption,
    color: colors.textTertiary,
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


