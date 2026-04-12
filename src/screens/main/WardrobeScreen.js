// author: caitriona mccann
// date: 12/03/2026
// wardrobe screen - view and manage clothing items in your wardrobe
// 2-column grid layout, filter by category, log wears, favorite items

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows, getGradeColor } from '../../theme/theme';
import { fetchWardrobe, removeFromWardrobe, logWear, updateWardrobeItem, importScansToWardrobe, listWardrobeItem } from '../../services/api';
import { useAlert } from '../../context/AlertContext';

const { width } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_WIDTH = (width - spacing.lg * 2 - CARD_GAP) / 2;

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Activewear', 'Accessories', 'General'];

const CATEGORY_ICONS = {
  All: 'grid-outline',
  Tops: 'shirt-outline',
  Bottoms: 'walk-outline',
  Dresses: 'woman-outline',
  Outerwear: 'cloudy-outline',
  Activewear: 'fitness-outline',
  Accessories: 'watch-outline',
  General: 'ellipsis-horizontal-outline',
};

const WardrobeScreen = () => {
  const { showAlert } = useAlert();
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  useFocusEffect(
    useCallback(() => {
      loadWardrobe(activeCategory);
    }, [activeCategory])
  );

  const loadWardrobe = async (category) => {
    setLoading(true);
    const result = await fetchWardrobe(category);
    if (result.success) {
      setItems(result.items || []);
    }
    setLoading(false);
  };

  const stats = useMemo(() => {
    const totalWears = items.reduce((sum, i) => sum + (i.wearCount || 0), 0);
    const favorites = items.filter(i => i.isFavorite).length;
    return { totalWears, favorites };
  }, [items]);

  const handleImportScans = async () => {
    const result = await importScansToWardrobe();
    if (result.success) {
      if (result.imported > 0) {
        showAlert('Imported', `Added ${result.imported} scan${result.imported > 1 ? 's' : ''} to your wardrobe`);
        loadWardrobe(activeCategory);
      } else {
        showAlert('Up to date', 'All your scans are already in your wardrobe');
      }
    } else {
      showAlert('Error', result.error || 'Failed to import scans');
    }
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };

  const handleToggleFavorite = async (item) => {
    const result = await updateWardrobeItem(item.id, { isFavorite: !item.isFavorite });
    if (result.success) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isFavorite: !i.isFavorite } : i));
    }
  };

  const handleLogWear = async (item) => {
    const result = await logWear(item.id);
    if (result.success) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, wearCount: (i.wearCount || 0) + 1, lastWorn: new Date().toISOString() } : i));
    }
  };

  const handleRemove = (item) => {
    showAlert(
      'Remove Item',
      `Remove "${item.name}" from your wardrobe?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeFromWardrobe(item.id);
            if (result.success) {
              setItems(prev => prev.filter(i => i.id !== item.id));
            } else {
              showAlert('Error', result.error || 'Failed to remove item');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item, index }) => {
    const hasImage = !!(item.imageUrl || item.thumbnailUrl);
    const imageUri = item.thumbnailUrl || item.imageUrl;
    const gradeColor = item.environmentalGrade ? getGradeColor(item.environmentalGrade) : null;

    return (
      <TouchableOpacity
        style={[styles.gridCard, index % 2 === 0 ? { marginRight: CARD_GAP / 2 } : { marginLeft: CARD_GAP / 2 }]}
        activeOpacity={0.8}
        onPress={() => {
          if (item.scanId) {
            navigation.navigate('ScanResult', { scanId: item.scanId, scanData: item });
          }
        }}
        onLongPress={() => {
          const isListed = !!item.availableFor;
          showAlert(
            item.name,
            null,
            [
              { text: 'Wore it', onPress: () => handleLogWear(item) },
              { text: item.isFavorite ? 'Unfavorite' : 'Favorite', onPress: () => handleToggleFavorite(item) },
              {
                text: isListed ? 'Remove from Market' : 'List on Market',
                onPress: () => {
                  if (isListed) {
                    listWardrobeItem(item.id, null).then(r => {
                      if (r.success) setItems(prev => prev.map(i => i.id === item.id ? { ...i, availableFor: null } : i));
                    });
                  } else {
                    showAlert('List on Marketplace', 'How would you like to list this item?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Give Away Free',
                        onPress: () => listWardrobeItem(item.id, 'free').then(r => {
                          if (r.success) {
                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, availableFor: 'free' } : i));
                            showAlert('Listed!', 'Item is now listed as free on the Marketplace.');
                          }
                        }),
                      },
                      {
                        text: 'Offer for Trade',
                        onPress: () => listWardrobeItem(item.id, 'trade').then(r => {
                          if (r.success) {
                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, availableFor: 'trade' } : i));
                            showAlert('Listed!', 'Item is now listed for trade on the Marketplace.');
                          }
                        }),
                      },
                    ]);
                  }
                },
              },
              { text: 'Remove', style: 'destructive', onPress: () => handleRemove(item) },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }}
      >
        {/* Image */}
        <View style={styles.gridImageContainer}>
          {hasImage ? (
            <Image source={{ uri: imageUri }} style={styles.gridImage} resizeMode="cover" />
          ) : (
            <View style={[styles.gridImage, styles.gridPlaceholder]}>
              <Ionicons name="shirt-outline" size={32} color={colors.textTertiary} />
            </View>
          )}
          {/* Grade badge */}
          {gradeColor && (
            <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
              <Text style={styles.gradeBadgeText}>{item.environmentalGrade}</Text>
            </View>
          )}
          {/* Listed badge */}
          {!!item.availableFor && (
            <View style={styles.listedBadge}>
              <Ionicons name="storefront" size={10} color="#fff" />
              <Text style={styles.listedBadgeText}>{item.availableFor === 'free' ? 'Free' : 'Trade'}</Text>
            </View>
          )}
          {/* Favorite heart */}
          <TouchableOpacity
            style={[styles.heartButton, item.isFavorite && styles.heartButtonActive]}
            onPress={() => handleToggleFavorite(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={item.isFavorite ? 'heart' : 'heart-outline'}
              size={14}
              color={item.isFavorite ? '#FFFFFF' : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.gridInfo}>
          <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
          {item.brand && <Text style={styles.gridBrand} numberOfLines={1}>{item.brand}</Text>}
          <View style={styles.gridFooter}>
            <View style={styles.wearBadge}>
              <Ionicons name="repeat-outline" size={10} color={colors.primary} />
              <Text style={styles.wearBadgeText}>{item.wearCount || 0}</Text>
            </View>
            {item.category && item.category !== 'General' && (
              <Text style={styles.gridCategory} numberOfLines={1}>{item.category}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backTouchable}
        >
          <View style={styles.backRow}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>My Wardrobe</Text>
            <Text style={styles.subtitle}>{items.length} pieces in your collection</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={handleImportScans}>
              <Ionicons name="download-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.outfitsBtn}
              onPress={() => navigation.navigate('Outfits')}
            >
              <Ionicons name="layers-outline" size={15} color="#FFFFFF" />
              <Text style={styles.outfitsBtnText}>Outfits</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statPill}>
          <Ionicons name="shirt-outline" size={14} color={colors.primary} />
          <Text style={styles.statPillValue}>{items.length}</Text>
          <Text style={styles.statPillLabel}>Items</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statPill}>
          <Ionicons name="repeat-outline" size={14} color={colors.primary} />
          <Text style={styles.statPillValue}>{stats.totalWears}</Text>
          <Text style={styles.statPillLabel}>Wears</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statPill}>
          <Ionicons name="heart" size={14} color="#E53E3E" />
          <Text style={styles.statPillValue}>{stats.favorites}</Text>
          <Text style={styles.statPillLabel}>Faves</Text>
        </View>
      </View>

      {/* Category filter */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => handleCategoryChange(cat)}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Items grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          accessibilityLabel="Wardrobe items"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyCircle}>
                <Ionicons name="shirt-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Your wardrobe is empty</Text>
              <Text style={styles.emptySubtext}>
                Scan clothing labels to build your collection, or import your scan history
              </Text>
              <TouchableOpacity style={styles.emptyCTA} onPress={handleImportScans}>
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyCTAText}>Import from Scans</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.emptySecondaryCTA} onPress={() => navigation.navigate('Camera')}>
                <Ionicons name="camera-outline" size={18} color={colors.primary} />
                <Text style={styles.emptySecondaryText}>Scan a Label</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  backTouchable: {
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: 2,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  outfitsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statPillValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statPillLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
  },
  // categories
  categoryBar: {
    height: 44,
    justifyContent: 'center',
  },
  categoryScroll: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  // loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // grid
  gridContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: 4,
  },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: CARD_GAP,
    overflow: 'hidden',
    ...shadows.soft,
  },
  gridImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.15,
    backgroundColor: colors.surfaceSecondary,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gradeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  listedBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  listedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartButtonActive: {
    backgroundColor: 'rgba(229, 62, 62, 0.9)',
  },
  // info
  gridInfo: {
    padding: 10,
  },
  gridName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  gridBrand: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 1,
  },
  gridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  wearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  wearBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  gridCategory: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  // empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 1.5,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  emptyCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  emptyCTAText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySecondaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  emptySecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default WardrobeScreen;
