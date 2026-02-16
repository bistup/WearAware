// author: caitriona mccann
// date: 09/02/2026
// alternative product card - shows a sustainable product recommendation
// includes brand, price, grade, and savings vs scanned item

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import Card from './Card';
import { colors, typography, spacing, borderRadius, getGradeColor } from '../theme/theme';

const AlternativeCard = ({ recommendation, scannedItem, onWishlist, onCompare, inWishlist }) => {
  const waterSaved = scannedItem
    ? Math.max(0, scannedItem.waterUsage - recommendation.waterUsage)
    : 0;
  const carbonSaved = scannedItem
    ? Math.max(0, scannedItem.carbonFootprint - recommendation.carbonFootprint)
    : 0;

  const handleOpenLink = () => {
    if (recommendation.externalUrl) {
      Linking.openURL(recommendation.externalUrl);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(recommendation.grade) }]}>
          <Text style={styles.gradeText}>{recommendation.grade}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.brand}>{recommendation.brand}</Text>
          <Text style={styles.productName} numberOfLines={1}>
            {recommendation.productName}
          </Text>
        </View>
        {recommendation.price > 0 && (
          <Text style={styles.price}>${recommendation.price.toFixed(0)}</Text>
        )}
      </View>

      {/* Sustainability Metrics */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Score</Text>
          <Text style={styles.metricValue}>{recommendation.score}/100</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Water</Text>
          <Text style={styles.metricValue}>{recommendation.waterUsage?.toFixed(0)}L</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>CO₂</Text>
          <Text style={styles.metricValue}>{recommendation.carbonFootprint?.toFixed(2)}kg</Text>
        </View>
      </View>

      {/* Savings vs Scanned Item */}
      {scannedItem && (waterSaved > 0 || carbonSaved > 0) && (
        <View style={styles.savingsRow}>
          {waterSaved > 0 && (
            <View style={styles.savingBadge}>
              <Text style={styles.savingText}>Water saved: {waterSaved.toFixed(0)}L</Text>
            </View>
          )}
          {carbonSaved > 0 && (
            <View style={styles.savingBadge}>
              <Text style={styles.savingText}>CO2 saved: {carbonSaved.toFixed(2)}kg</Text>
            </View>
          )}
        </View>
      )}

      {/* Primary Fiber */}
      {recommendation.primaryFiber && (
        <Text style={styles.fiberInfo}>
          Made with: {recommendation.primaryFiber}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.wishlistButton, inWishlist && styles.wishlistButtonActive]}
          onPress={() => onWishlist?.(recommendation.id)}
        >
          <Text style={styles.wishlistText}>
            {inWishlist ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>

        {onCompare && (
          <TouchableOpacity
            style={styles.compareButton}
            onPress={() => onCompare?.(recommendation)}
          >
            <Text style={styles.compareText}>Compare</Text>
          </TouchableOpacity>
        )}

        {recommendation.externalUrl && (
          <TouchableOpacity style={styles.linkButton} onPress={handleOpenLink}>
            <Text style={styles.linkText}>Visit →</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gradeBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  gradeText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.background,
  },
  info: {
    flex: 1,
  },
  brand: {
    ...typography.body,
    fontWeight: '700',
  },
  productName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  price: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  metricValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  savingsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  savingBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  savingText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  fiberInfo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  wishlistButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  wishlistButtonActive: {
    backgroundColor: colors.primary,
  },
  wishlistText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
  },
  compareButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compareText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  linkButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
  },
  linkText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.background,
  },
});

export default AlternativeCard;
