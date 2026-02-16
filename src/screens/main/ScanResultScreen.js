// author: caitriona mccann
// date: 27/11/2025
// last updated: 09/02/2026
// shows the results after scanning - environmental grade, fibers, water and co2 impact
// you can edit the brand and item type here if the vision api got it wrong
// added: share to community + alternatives prompt for low-grade scans

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Card from '../../components/Card';
import Button from '../../components/Button';
import GradeIndicator from '../../components/GradeIndicator';
import ItemTypePickerModal from '../../components/ItemTypePickerModal';
import CareIcon from '../../components/CareIcon';
import ShareScanModal from '../../components/ShareScanModal';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/theme';
import { deleteScan, saveScanToBackend, generateAiSummary, generateAiSummaryFromData } from '../../services/api';
import { createPost, checkAchievements, updateChallengeProgress } from '../../services/api';
import { ITEM_TYPES } from '../../constants/constants';
import { useAuth } from '../../context/AuthContext';

const ScanResultScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isGuest } = useAuth();
  const { scanData, scanId } = route.params || {};
  
  const [selectedItemType, setSelectedItemType] = useState(scanData?.itemType || scanData?.item_type || 'Garment');
  const [showItemTypeModal, setShowItemTypeModal] = useState(false);
  const [updatedScanData, setUpdatedScanData] = useState(scanData);
  const [brandName, setBrandName] = useState(scanData?.brand || '');
  const [aiSummary, setAiSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [activeTab, setActiveTab] = useState('sustainability'); // 'sustainability' or 'care'
  const [showShareModal, setShowShareModal] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState([]);
  
  // update scan data when route params change
  useEffect(() => {
    if (scanData) {
      console.log('ScanResultScreen received scanData:', JSON.stringify(scanData, null, 2));
      setUpdatedScanData(scanData);
      // generate AI summary immediately when scan data arrives
      fetchSummaryFromData(scanData);
    }
  }, [scanData]);

  // check achievements and update challenge progress after scan
  useEffect(() => {
    if (scanData && !isGuest) {
      const triggerGamification = async () => {
        try {
          const achievementResult = await checkAchievements('scan', { grade: scanData.grade });
          if (achievementResult.success && achievementResult.newlyUnlocked?.length > 0) {
            setNewlyUnlocked(achievementResult.newlyUnlocked);
          }
          await updateChallengeProgress('scan', 1);
          if (scanData.grade === 'A') {
            await checkAchievements('grade_a', {});
          }
        } catch (err) {
          console.log('Gamification check failed:', err);
        }
      };
      triggerGamification();
    }
  }, [scanData]);

  // fetch AI summary when scan ID is available
  useEffect(() => {
    if (scanId && !aiSummary) {
      fetchSummary();
    }
  }, [scanId]);

  const fetchSummaryFromData = async (data) => {
    setLoadingSummary(true);
    const result = await generateAiSummaryFromData(data);
    if (result.success) {
      setAiSummary(result.summary);
    } else {
      console.log('Failed to generate summary:', result.error);
      setAiSummary(`AI summary unavailable: ${result.error || 'Service not responding'}`);
    }
    setLoadingSummary(false);
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    const result = await generateAiSummary(scanId);
    if (result.success) {
      setAiSummary(result.summary);
    } else {
      console.log('Failed to generate summary:', result.error);
      setAiSummary(`AI summary unavailable: ${result.error || 'Service not responding'}`);
    }
    setLoadingSummary(false);
  };

  // handle item type selection and recalculate impact
  const handleItemTypeSelect = async (itemType) => {
    setSelectedItemType(itemType.name);
    setShowItemTypeModal(false);
    
    // recalculate with new item type
    const newScanData = {
      ...updatedScanData,
      itemType: itemType.name,
      brand: brandName || updatedScanData.brand,
    };
    
    // save updated scan to backend to recalculate environmental impact
    const result = await saveScanToBackend(newScanData);
    
    if (result.success && result.scan) {
      setUpdatedScanData(result.scan);
    }
  };

  // share scan to community feed
  const handleShareScan = async ({ caption, isPublic }) => {
    if (isGuest) {
      Alert.alert('Sign In Required', 'Create an account to share scans with the community.');
      return;
    }
    try {
      const result = await createPost({
        scanId: scanId,
        caption,
        visibility: isPublic ? 'public' : 'private',
      });
      if (result.success) {
        setShowShareModal(false);
        // check for share achievement
        await checkAchievements('share', {});
        Alert.alert('Shared!', 'Your scan has been posted to the community feed.');
      } else {
        Alert.alert('Error', result.error || 'Failed to share scan.');
      }
    } catch (err) {
      console.error('Share failed:', err);
      Alert.alert('Error', 'Failed to share scan.');
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
    careInstructions = [],
  } = updatedScanData || {};

  // use item_type from database or itemType, update selectedItemType on load
  const displayItemType = item_type || itemType || selectedItemType;
  
  useEffect(() => {
    if (item_type || itemType) {
      setSelectedItemType(item_type || itemType);
    }
  }, [item_type, itemType]);

  const hasCareInstructions = careInstructions && careInstructions.length > 0;

  const groupedCareInstructions = hasCareInstructions ? {
    wash: careInstructions.filter(i => i.type === 'wash'),
    bleach: careInstructions.filter(i => i.type === 'bleach'),
    dry: careInstructions.filter(i => i.type === 'dry'),
    iron: careInstructions.filter(i => i.type === 'iron'),
    dryclean: careInstructions.filter(i => i.type === 'dryclean'),
    color: careInstructions.filter(i => i.type === 'color'),
  } : {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back to Home"
        >
          <Text style={styles.backText}>← Home</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Scan Results</Text>

        {/* Scan Image */}
        {updatedScanData?.imageUrl && (
          <Image
            source={{ uri: updatedScanData.imageUrl }}
            style={styles.scanImage}
            resizeMode="cover"
          />
        )}

        {/* Tab Selector */}
        {hasCareInstructions && (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'sustainability' && styles.tabActive]}
              onPress={() => setActiveTab('sustainability')}
            >
              <Text style={[styles.tabText, activeTab === 'sustainability' && styles.tabTextActive]}>
                Sustainability
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'care' && styles.tabActive]}
              onPress={() => setActiveTab('care')}
            >
              <Text style={[styles.tabText, activeTab === 'care' && styles.tabTextActive]}>
                Care Instructions
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'sustainability' ? (
          <>
            {/* Sustainability content */}

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

        <Card style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>AI Environmental Analysis</Text>
          {loadingSummary ? (
            <Text style={styles.summaryText}>Generating insights...</Text>
          ) : aiSummary ? (
            <Text style={styles.summaryText}>{aiSummary}</Text>
          ) : (
            <Text style={styles.summaryText}>Summary unavailable</Text>
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

        {/* Achievement Notification */}
        {newlyUnlocked.length > 0 && (
          <Card style={styles.achievementCard}>
            <Text style={styles.achievementHeader}>Achievement Unlocked!</Text>
            {newlyUnlocked.map((a, i) => (
              <Text key={i} style={styles.achievementName}>
                {a.name}
              </Text>
            ))}
            <TouchableOpacity onPress={() => navigation.navigate('Challenges')}>
              <Text style={styles.achievementLink}>View All Achievements →</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Better Alternatives Prompt (for D and F grades) */}
        {(grade === 'D' || grade === 'F') && (
          <TouchableOpacity
            style={styles.alternativesPrompt}
            onPress={() => navigation.navigate('Alternatives', { scanData: updatedScanData, scanId })}
          >
            <Card style={styles.alternativesCard}>
              <View style={styles.alternativesIconBox}><Text style={styles.alternativesIconText}>ALT</Text></View>
              <View style={styles.alternativesInfo}>
                <Text style={styles.alternativesTitle}>Better Alternatives Available</Text>
                <Text style={styles.alternativesDesc}>
                  Discover more sustainable options for this item type
                </Text>
              </View>
              <Text style={styles.alternativesArrow}>→</Text>
            </Card>
          </TouchableOpacity>
        )}

        <View style={styles.actions}>
          <Button
            title="View Breakdown"
            onPress={() => navigation.navigate('Breakdown', { scanData: updatedScanData, scanId })}
          />
          {scanId && !isGuest && (
            <Button
              title="Share to Community"
              onPress={() => setShowShareModal(true)}
              variant="secondary"
              style={styles.shareButton}
            />
          )}
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
          </>
        ) : (
          <>
            {/* Care Instructions Tab */}
            {groupedCareInstructions.wash && groupedCareInstructions.wash.length > 0 && (
              <Card style={styles.careCard}>
                <Text style={styles.sectionTitle}>Washing</Text>
                {groupedCareInstructions.wash.map((instruction, index) => (
                  <View key={index} style={styles.careRow}>
                    <View style={styles.careIconContainer}>
                      <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                    </View>
                    <View style={styles.careContent}>
                      <Text style={styles.careText}>{instruction.instruction}</Text>
                      {instruction.temperature && (
                        <Text style={styles.careTempHint}>{instruction.temperature}°C</Text>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {groupedCareInstructions.bleach && groupedCareInstructions.bleach.length > 0 && (
              <Card style={styles.careCard}>
                <Text style={styles.sectionTitle}>△ Bleaching</Text>
                {groupedCareInstructions.bleach.map((instruction, index) => (
                  <View key={index} style={styles.careRow}>
                    <View style={styles.careIconContainer}>
                      <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                    </View>
                    <Text style={styles.careText}>{instruction.instruction}</Text>
                  </View>
                ))}
              </Card>
            )}

            {groupedCareInstructions.dry && groupedCareInstructions.dry.length > 0 && (
              <Card style={styles.careCard}>
                <Text style={styles.sectionTitle}>⬜ Drying</Text>
                {groupedCareInstructions.dry.map((instruction, index) => (
                  <View key={index} style={styles.careRow}>
                    <View style={styles.careIconContainer}>
                      <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                    </View>
                    <View style={styles.careContent}>
                      <Text style={styles.careText}>{instruction.instruction}</Text>
                      {instruction.temperature && (
                        <Text style={styles.careTempHint}>Heat: {instruction.temperature}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {groupedCareInstructions.iron && groupedCareInstructions.iron.length > 0 && (
              <Card style={styles.careCard}>
                <Text style={styles.sectionTitle}>⚠ Ironing</Text>
                {groupedCareInstructions.iron.map((instruction, index) => (
                  <View key={index} style={styles.careRow}>
                    <View style={styles.careIconContainer}>
                      <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                    </View>
                    <View style={styles.careContent}>
                      <Text style={styles.careText}>{instruction.instruction}</Text>
                      {instruction.temperature && (
                        <Text style={styles.careTempHint}>{instruction.temperature}°C</Text>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {groupedCareInstructions.dryclean && groupedCareInstructions.dryclean.length > 0 && (
              <Card style={styles.careCard}>
                <Text style={styles.sectionTitle}>○ Dry Cleaning</Text>
                {groupedCareInstructions.dryclean.map((instruction, index) => (
                  <View key={index} style={styles.careRow}>
                    <View style={styles.careIconContainer}>
                      <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                    </View>
                    <Text style={styles.careText}>{instruction.instruction}</Text>
                  </View>
                ))}
              </Card>
            )}

            {groupedCareInstructions.color && groupedCareInstructions.color.length > 0 && (
              <Card style={styles.careCard}>
                <Text style={styles.sectionTitle}>Color Care</Text>
                {groupedCareInstructions.color.map((instruction, index) => (
                  <View key={index} style={styles.careRow}>
                    <View style={styles.careIconContainer}>
                      {instruction.iconName ? (
                        <CareIcon name={instruction.iconName} size={40} color={colors.text} />
                      ) : (
                        <Text style={styles.careIconPlaceholder}>•</Text>
                      )}
                    </View>
                    <Text style={styles.careText}>{instruction.instruction}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {/* reusable item type picker modal */}
      <ItemTypePickerModal
        visible={showItemTypeModal}
        onClose={() => setShowItemTypeModal(false)}
        onSelect={handleItemTypeSelect}
        selectedType={selectedItemType}
      />

      {/* Share to community modal */}
      <ShareScanModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={handleShareScan}
        scanData={updatedScanData}
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
    minHeight: 44,
    justifyContent: 'center',
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
  scanImage: {
    width: '100%',
    height: 300,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
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
  summaryCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
  },
  summaryText: {
    ...typography.body,
    lineHeight: 24,
    color: colors.text,
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
    backgroundColor: colors.border,
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
    borderColor: colors.error,
    borderWidth: 1,
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
  tabContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: 4,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.background,
    fontWeight: '600',
  },
  careCard: {
    marginBottom: spacing.md,
  },
  careRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  careIconContainer: {
    marginRight: spacing.md,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  careIconPlaceholder: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  careContent: {
    flex: 1,
  },
  careText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  careTempHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  // social & gamification styles
  shareButton: {
    marginTop: spacing.sm,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  achievementCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.warningLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  achievementHeader: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  achievementName: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  achievementLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  alternativesPrompt: {
    marginBottom: spacing.md,
  },
  alternativesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  alternativesIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  alternativesIconText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
    fontSize: 12,
  },
  alternativesInfo: {
    flex: 1,
  },
  alternativesTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  alternativesDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  alternativesArrow: {
    ...typography.h2,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
});

export default ScanResultScreen;


