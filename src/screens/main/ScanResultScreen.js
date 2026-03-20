// author: caitriona mccann
// date: 27/11/2025
// last updated: 19/02/2026
// scan results - modernised layout with hero grade, quick stats, fiber bars
// always shows alternatives, AI summary via Ollama, care instructions tab

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Card from '../../components/Card';
import GradeIndicator from '../../components/GradeIndicator';
import ItemTypePickerModal from '../../components/ItemTypePickerModal';
import CareIcon from '../../components/CareIcon';
import ShareScanModal from '../../components/ShareScanModal';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, getGradeColor } from '../../theme/theme';
import { deleteScan, saveScanToBackend, generateAiSummary, generateAiSummaryFromData, fetchVisualRecommendations, addToWardrobe, listWardrobeItem } from '../../services/api';
import { createPost, checkAchievements, updateChallengeProgress } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

const ScanResultScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, isGuest } = useAuth();
  const { showAlert } = useAlert();
  const { scanData, scanId } = route.params || {};

  const isVisualScan = scanData?.scanType === 'visual' || scanData?.scan_type === 'visual';

  const [selectedItemType, setSelectedItemType] = useState(scanData?.itemType || scanData?.item_type || 'Garment');
  const [showItemTypeModal, setShowItemTypeModal] = useState(false);
  const [updatedScanData, setUpdatedScanData] = useState(scanData);
  const [brandName, setBrandName] = useState(scanData?.brand || '');
  const [aiSummary, setAiSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [activeTab, setActiveTab] = useState('sustainability');
  const [showShareModal, setShowShareModal] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState([]);
  const [visualRecs, setVisualRecs] = useState([]);
  const [loadingVisualRecs, setLoadingVisualRecs] = useState(false);

  useEffect(() => {
    if (scanData) {
      console.log('ScanResultScreen received scanData:', JSON.stringify(scanData, null, 2));
      setUpdatedScanData(scanData);
      if (!isVisualScan) {
        fetchSummaryFromData(scanData);
      }
    }
  }, [scanData]);

  // fetch visual recommendations for any scan with an image (CLIP embedding)
  useEffect(() => {
    if (scanId) {
      // for visual scans, load immediately
      // for normal scans with images, delay slightly to let backend extract CLIP embedding
      const hasImage = !!(scanData?.imageUrl || scanData?.image_url);
      if (isVisualScan) {
        loadVisualRecommendations();
      } else if (hasImage) {
        // give backend 3 seconds to extract CLIP embedding, then try
        const timer = setTimeout(() => loadVisualRecommendations(), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [scanId]);

  const loadVisualRecommendations = async () => {
    setLoadingVisualRecs(true);
    const result = await fetchVisualRecommendations(scanId);
    if (result.success) {
      setVisualRecs(result.recommendations || []);
    }
    setLoadingVisualRecs(false);
  };

  useEffect(() => {
    if (scanData && !isGuest && !isVisualScan) {
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

  useEffect(() => {
    // only fetch by scanId if we don't have scanData (e.g. navigating from history)
    // when scanData exists, fetchSummaryFromData already handles it above
    if (scanId && !aiSummary && !scanData && !isVisualScan) {
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
      setAiSummary('');
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
      setAiSummary('');
    }
    setLoadingSummary(false);
  };

  const handleItemTypeSelect = async (itemType) => {
    setSelectedItemType(itemType.name);
    setShowItemTypeModal(false);

    const newScanData = {
      ...updatedScanData,
      itemType: itemType.name,
      brand: brandName || updatedScanData.brand,
    };

    const result = await saveScanToBackend(newScanData);
    if (result.success && result.scan) {
      setUpdatedScanData(result.scan);
    }
  };

  const handleShareScan = async ({ caption, isPublic }) => {
    if (isGuest) {
      showAlert('Sign In Required', 'Create an account to share scans with the community.');
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
        await checkAchievements('share', {});
        showAlert('Shared!', 'Your scan has been posted to the community feed.');
      } else {
        showAlert('Error', result.error || 'Failed to share scan.');
      }
    } catch (err) {
      console.error('Share failed:', err);
      showAlert('Error', 'Failed to share scan.');
    }
  };

  const handleDelete = () => {
    showAlert(
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
                showAlert('Error', result.error || 'Failed to delete scan');
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

  const waterVal = water_usage_liters != null && typeof water_usage_liters === 'number'
    ? water_usage_liters.toFixed(1) + 'L' : '--';
  const carbonVal = carbon_footprint_kg != null && typeof carbon_footprint_kg === 'number'
    ? carbon_footprint_kg.toFixed(2) + 'kg' : '--';
  const weightVal = item_weight_grams ? item_weight_grams + 'g' : '--';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back to Home"
        >
          <View style={styles.backRow}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Home</Text>
          </View>
        </TouchableOpacity>

        {/* Hero Section - Scan image with grade overlay */}
        {(updatedScanData?.imageUrl || updatedScanData?.image_url) ? (
          <View style={styles.heroImageContainer}>
            <Image
              source={{ uri: updatedScanData.imageUrl || updatedScanData.image_url }}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroImageOverlay} />
            {/* Grade badge overlaid on image */}
            {isVisualScan ? (
              <View style={styles.heroOverlayBadge}>
                <View style={styles.visualScanBadge}>
                  <Text style={styles.visualScanBadgeText}>Visual Scan</Text>
                </View>
              </View>
            ) : (
              <View style={styles.heroOverlayBadge}>
                <GradeIndicator grade={grade} size="medium" />
                <Text style={styles.heroOverlayScore}>{score}/100</Text>
              </View>
            )}
            {/* Info bar at bottom of image */}
            <View style={styles.heroImageInfo}>
              <Text style={styles.heroImageBrand}>{brand}</Text>
              <TouchableOpacity
                style={styles.heroItemType}
                onPress={() => setShowItemTypeModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Change item type"
              >
                <Text style={styles.heroItemTypeText}>{displayItemType}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.textTertiary} style={{ marginLeft: spacing.xs }} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.heroSection}>
            {isVisualScan ? (
              <>
                <View style={styles.visualScanBadge}>
                  <Text style={styles.visualScanBadgeText}>Visual Scan</Text>
                </View>
                <Text style={styles.heroBrand}>{brand}</Text>
              </>
            ) : (
              <>
                <GradeIndicator grade={grade} size="large" />
                <Text style={styles.heroScore}>{score}/100</Text>
                <Text style={styles.heroBrand}>{brand}</Text>
              </>
            )}
            <TouchableOpacity
              style={styles.heroItemType}
              onPress={() => setShowItemTypeModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Change item type"
            >
              <Text style={styles.heroItemTypeText}>{displayItemType}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textTertiary} style={{ marginLeft: spacing.xs }} />
            </TouchableOpacity>
            {madeIn && madeIn !== 'Undetected' && (
              <Text style={styles.heroMadeIn}>Made in {madeIn}</Text>
            )}
          </View>
        )}
        {/* Made in label (shown under image hero) */}
        {(updatedScanData?.imageUrl || updatedScanData?.image_url) && madeIn && madeIn !== 'Undetected' && (
          <Text style={[styles.heroMadeIn, { textAlign: 'center', marginBottom: spacing.md }]}>Made in {madeIn}</Text>
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
            {/* Quick Stats Row - hide for visual scans */}
            {!isVisualScan && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="water-outline" size={20} color={colors.primary} style={{ marginBottom: spacing.xs }} />
                <Text style={styles.statValue}>{waterVal}</Text>
                <Text style={styles.statLabel}>Water</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="cloud-outline" size={20} color={colors.textSecondary} style={{ marginBottom: spacing.xs }} />
                <Text style={styles.statValue}>{carbonVal}</Text>
                <Text style={styles.statLabel}>CO₂</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="scale-outline" size={20} color={colors.textSecondary} style={{ marginBottom: spacing.xs }} />
                <Text style={styles.statValue}>{weightVal}</Text>
                <Text style={styles.statLabel}>Weight</Text>
              </View>
            </View>
            )}

            {/* AI Environmental Analysis - hide for visual scans */}
            {!isVisualScan && (
            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.sectionTitle}>AI Analysis</Text>
                {loadingSummary && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </View>
              {loadingSummary ? (
                <Text style={styles.summaryText}>Generating environmental insights...</Text>
              ) : aiSummary ? (
                <Text style={styles.summaryText}>{aiSummary}</Text>
              ) : (
                <Text style={styles.summaryTextMuted}>AI analysis unavailable - service may be loading</Text>
              )}
            </Card>
            )}

            {/* Fiber Composition with progress bars - hide for visual scans */}
            {!isVisualScan && (
            <Card style={styles.fibersCard}>
              <Text style={styles.sectionTitle}>Fiber Composition</Text>
              {fibers.length > 0 ? (
                fibers.map((fiber, index) => (
                  <View key={index} style={styles.fiberItem}>
                    <View style={styles.fiberLabelRow}>
                      <Text style={styles.fiberName}>{fiber.name}</Text>
                      <Text style={styles.fiberPercent}>{fiber.percentage}%</Text>
                    </View>
                    <View style={styles.fiberBarBg}>
                      <View
                        style={[
                          styles.fiberBarFill,
                          {
                            width: `${Math.min(fiber.percentage, 100)}%`,
                            backgroundColor: getGradeColor(grade),
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No fiber data available</Text>
              )}
            </Card>
            )}

            {/* Sustainable Alternatives - always visible */}
            <TouchableOpacity
              style={styles.alternativesPrompt}
              onPress={() => navigation.navigate('Alternatives', { scanData: updatedScanData, scanId })}
              accessibilityRole="button"
              accessibilityLabel="View sustainable alternatives"
            >
              <Card style={styles.alternativesCard}>
                <View style={styles.alternativesIconBox}>
                  <Ionicons name="leaf-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.alternativesInfo}>
                  <Text style={styles.alternativesTitle}>Sustainable Alternatives</Text>
                  <Text style={styles.alternativesDesc}>
                    Discover eco-friendly options for this {displayItemType.toLowerCase()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.primary} />
              </Card>
            </TouchableOpacity>

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

            {/* Visually Similar Alternatives (shown when CLIP embedding available) */}
            {(visualRecs.length > 0 || loadingVisualRecs) && (
              <Card style={styles.visualRecsCard}>
                <Text style={styles.sectionTitle}>Visually Similar Alternatives</Text>
                {loadingVisualRecs ? (
                  <View style={styles.visualRecsLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.summaryText}>Finding similar items...</Text>
                  </View>
                ) : visualRecs.length > 0 ? (
                  <>
                    {visualRecs.slice(0, 3).map((rec, i) => (
                      <TouchableOpacity
                        key={rec.id || i}
                        style={styles.visualRecItem}
                        onPress={() => navigation.navigate('Alternatives', { scanData: updatedScanData, scanId })}
                      >
                        <View style={styles.visualRecLeft}>
                          <Text style={styles.visualRecBrand}>{rec.brand}</Text>
                          <Text style={styles.visualRecName}>{rec.productName}</Text>
                        </View>
                        <View style={styles.visualRecRight}>
                          <Text style={styles.visualRecMatchPct}>{rec.matchPercentage}%</Text>
                          <Text style={styles.visualRecMatchLabel}>match</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {visualRecs.length > 3 && (
                      <TouchableOpacity
                        onPress={() => navigation.navigate('Alternatives', { scanData: updatedScanData, scanId })}
                      >
                        <Text style={styles.visualRecsSeeAll}>
                          See all {visualRecs.length} matches →
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <Text style={styles.summaryTextMuted}>
                    No visually similar alternatives found yet
                  </Text>
                )}
              </Card>
            )}

            {/* Action Buttons - icon + label stacked, equal-width columns */}
            <View style={styles.actionsRow}>
              {scanId && !isGuest && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setShowShareModal(true)}
                >
                  <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
                  <Text style={styles.actionBtnText}>Share</Text>
                </TouchableOpacity>
              )}
              {scanId && !isGuest && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={async () => {
                    const result = await addToWardrobe({
                      scanId,
                      name: updatedScanData.brand ? `${updatedScanData.brand} ${updatedScanData.itemType || 'Item'}` : (updatedScanData.itemType || 'Scanned Item'),
                      brand: updatedScanData.brand,
                      itemType: updatedScanData.itemType,
                      imageUrl: updatedScanData.imageUrl || updatedScanData.image_url,
                      thumbnailUrl: updatedScanData.thumbnailUrl || updatedScanData.thumbnail_url,
                      environmentalGrade: updatedScanData.grade,
                      environmentalScore: updatedScanData.score || updatedScanData.environmentalScore,
                      fibers: updatedScanData.fibers,
                    });
                    if (result.success) {
                      showAlert('Added', 'Item added to your wardrobe!');
                    } else {
                      showAlert('Note', result.error || 'Could not add to wardrobe');
                    }
                  }}
                >
                  <Ionicons name="shirt-outline" size={22} color={colors.textPrimary} />
                  <Text style={styles.actionBtnText}>Wardrobe</Text>
                </TouchableOpacity>
              )}
              {scanId && !isGuest && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    showAlert(
                      'List on Marketplace',
                      'How would you like to list this item?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Give Away Free',
                          onPress: async () => {
                            const wardrobeResult = await addToWardrobe({
                              scanId,
                              name: updatedScanData.brand ? `${updatedScanData.brand} ${updatedScanData.itemType || 'Item'}` : (updatedScanData.itemType || 'Scanned Item'),
                              brand: updatedScanData.brand,
                              itemType: updatedScanData.itemType,
                              imageUrl: updatedScanData.imageUrl || updatedScanData.image_url,
                              thumbnailUrl: updatedScanData.thumbnailUrl || updatedScanData.thumbnail_url,
                              environmentalGrade: updatedScanData.grade,
                              environmentalScore: updatedScanData.score || updatedScanData.environmentalScore,
                              fibers: updatedScanData.fibers,
                            });
                            const itemId = wardrobeResult.item?.id;
                            if (itemId) {
                              await listWardrobeItem(itemId, 'free');
                              showAlert('Listed!', 'Item is now listed as free on the Marketplace.');
                            } else {
                              showAlert('Error', 'Could not list item.');
                            }
                          },
                        },
                        {
                          text: 'Offer for Trade',
                          onPress: async () => {
                            const wardrobeResult = await addToWardrobe({
                              scanId,
                              name: updatedScanData.brand ? `${updatedScanData.brand} ${updatedScanData.itemType || 'Item'}` : (updatedScanData.itemType || 'Scanned Item'),
                              brand: updatedScanData.brand,
                              itemType: updatedScanData.itemType,
                              imageUrl: updatedScanData.imageUrl || updatedScanData.image_url,
                              thumbnailUrl: updatedScanData.thumbnailUrl || updatedScanData.thumbnail_url,
                              environmentalGrade: updatedScanData.grade,
                              environmentalScore: updatedScanData.score || updatedScanData.environmentalScore,
                              fibers: updatedScanData.fibers,
                            });
                            const itemId = wardrobeResult.item?.id;
                            if (itemId) {
                              await listWardrobeItem(itemId, 'trade');
                              showAlert('Listed!', 'Item is now listed for trade on the Marketplace.');
                            } else {
                              showAlert('Error', 'Could not list item.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="storefront-outline" size={22} color={colors.textPrimary} />
                  <Text style={styles.actionBtnText}>Market</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('EditScan', { scanData: updatedScanData, scanId })}
              >
                <Ionicons name="create-outline" size={22} color={colors.textPrimary} />
                <Text style={styles.actionBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('Breakdown', { scanData: updatedScanData, scanId })}
              >
                <Ionicons name="analytics-outline" size={22} color={colors.textPrimary} />
                <Text style={styles.actionBtnText}>Details</Text>
              </TouchableOpacity>
              {scanId && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                  <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Delete</Text>
                </TouchableOpacity>
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
                <Text style={styles.sectionTitle}>Bleaching</Text>
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
                <Text style={styles.sectionTitle}>Drying</Text>
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
                <Text style={styles.sectionTitle}>Ironing</Text>
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
                <Text style={styles.sectionTitle}>Dry Cleaning</Text>
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

      <ItemTypePickerModal
        visible={showItemTypeModal}
        onClose={() => setShowItemTypeModal(false)}
        onSelect={handleItemTypeSelect}
        selectedType={selectedItemType}
      />

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
    paddingBottom: spacing.xxl,
  },
  backButton: {
    marginBottom: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },

  // Hero section
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
  },
  heroImageContainer: {
    width: '100%',
    height: 280,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  heroOverlayBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    alignItems: 'center',
  },
  heroOverlayScore: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroImageInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroImageBrand: {
    ...typography.h3,
    color: '#FFFFFF',
    fontWeight: '700',
    flex: 1,
  },
  heroScore: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  visualScanBadge: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  visualScanBadgeText: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  heroBrand: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  heroItemType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.full,
  },
  heroItemTypeText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  heroMadeIn: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },

  // Tab selector
  tabContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
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

  // Quick stats row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // AI summary
  summaryCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryText: {
    ...typography.body,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  summaryTextMuted: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // Fibers
  fibersCard: {
    marginBottom: spacing.md,
  },
  fiberItem: {
    marginBottom: spacing.sm,
  },
  fiberLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  fiberName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  fiberPercent: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.primary,
  },
  fiberBarBg: {
    height: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fiberBarFill: {
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },

  // Alternatives prompt
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
    backgroundColor: colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
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
  // Achievement
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

  // Action buttons row
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionBtnDanger: {
    borderColor: colors.error,
  },
  actionBtnDangerText: {
    color: colors.error,
  },

  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },

  // Care instructions
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

  // Visual recommendations
  visualRecsCard: {
    marginBottom: spacing.md,
  },
  visualRecsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  visualRecItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  visualRecLeft: {
    flex: 1,
  },
  visualRecBrand: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  visualRecName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  visualRecRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  visualRecMatchPct: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  visualRecMatchLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  visualRecsSeeAll: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.md,
    textAlign: 'center',
  },
});

export default ScanResultScreen;
