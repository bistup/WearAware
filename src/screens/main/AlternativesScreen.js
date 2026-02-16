// author: caitriona mccann
// date: 09/02/2026
// alternatives screen - shows sustainable product recommendations after a scan
// users can compare, save to wishlist, and visit external shops

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import AlternativeCard from '../../components/AlternativeCard';
import Card from '../../components/Card';
import GradeIndicator from '../../components/GradeIndicator';
import { colors, typography, spacing, borderRadius, getGradeColor } from '../../theme/theme';
import { fetchRecommendations, fetchComparison, addToWishlist, removeFromWishlist } from '../../services/api';

const AlternativesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { scanData, scanId } = route.params || {};

  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState(new Set());

  const scannedItem = scanData ? {
    waterUsage: scanData.water_usage_liters || scanData.waterUsage || 0,
    carbonFootprint: scanData.carbon_footprint_kg || scanData.carbonFootprint || 0,
    score: scanData.score || 0,
    grade: scanData.grade || 'C',
  } : null;

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    setLoading(true);
    const itemType = scanData?.item_type || scanData?.itemType || 'Garment';
    const currentScore = scanData?.score || 50;
    const result = await fetchRecommendations(itemType, currentScore);
    if (result.success) {
      setRecommendations(result.recommendations || []);
    }
    setLoading(false);
  };

  const handleWishlist = async (recommendationId) => {
    if (wishlistIds.has(recommendationId)) {
      // remove from wishlist (we don't have the wishlist entry id, so toggle off locally)
      setWishlistIds(prev => {
        const next = new Set(prev);
        next.delete(recommendationId);
        return next;
      });
    } else {
      const result = await addToWishlist(recommendationId);
      if (result.success) {
        setWishlistIds(prev => new Set(prev).add(recommendationId));
      }
    }
  };

  const handleCompare = (recommendation) => {
    navigation.navigate('Comparison', {
      scanData: scanData,
      scanId: scanId,
      alternativeData: {
        brand: recommendation.brand,
        productName: recommendation.productName,
        score: recommendation.score,
        grade: recommendation.grade,
        waterUsage: recommendation.waterUsage,
        carbonFootprint: recommendation.carbonFootprint,
        primaryFiber: recommendation.primaryFiber,
      },
    });
  };

  const renderHeader = () => (
    <View>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Better Alternatives</Text>
      <Text style={styles.subtitle}>
        Sustainable options for your {scanData?.item_type || scanData?.itemType || 'item'}
      </Text>

      {/* Current Scan Summary */}
      {scannedItem && (
        <Card style={styles.currentScanCard}>
          <Text style={styles.currentLabel}>Your Scanned Item</Text>
          <View style={styles.currentRow}>
            <View style={[styles.currentGrade, { backgroundColor: getGradeColor(scannedItem.grade) }]}>
              <Text style={styles.currentGradeText}>{scannedItem.grade}</Text>
            </View>
            <View style={styles.currentInfo}>
              <Text style={styles.currentBrand}>{scanData?.brand || 'Unknown'}</Text>
              <Text style={styles.currentScore}>Score: {scannedItem.score}/100</Text>
            </View>
            <View style={styles.currentMetrics}>
              <Text style={styles.currentMetric}>{scannedItem.waterUsage?.toFixed(0)}L</Text>
              <Text style={styles.currentMetric}>{scannedItem.carbonFootprint?.toFixed(2)}kg</Text>
            </View>
          </View>
        </Card>
      )}

      <Text style={styles.resultsLabel}>
        {recommendations.length} sustainable alternative{recommendations.length !== 1 ? 's' : ''} found
      </Text>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Great Choice!</Text>
        <Text style={styles.emptyText}>
          Your item already has a high sustainability score. No better alternatives found in our database.
        </Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() => navigation.navigate('Wishlist')}
        >
          <Text style={styles.browseText}>Browse Wishlist →</Text>
        </TouchableOpacity>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding sustainable alternatives...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={recommendations}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={({ item }) => (
          <AlternativeCard
            recommendation={item}
            scannedItem={scannedItem}
            onWishlist={handleWishlist}
            onCompare={handleCompare}
            inWishlist={wishlistIds.has(item.id)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  currentScanCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  currentLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentGrade: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  currentGradeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  currentInfo: {
    flex: 1,
  },
  currentBrand: {
    ...typography.body,
    fontWeight: '600',
  },
  currentScore: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  currentMetrics: {
    alignItems: 'flex-end',
  },
  currentMetric: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  resultsLabel: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  browseButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  browseText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
});

export default AlternativesScreen;
