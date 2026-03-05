// author: caitriona mccann
// date: 30/01/2026
// side-by-side comparison screen for two scanned items
// shows visual metrics comparison including grades, water, carbon, fibers

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import GradeIndicator from '../../components/GradeIndicator';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';

const ComparisonScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { scans } = route.params || { scans: [] };

  if (!scans || scans.length !== 2) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
            <View style={styles.backRow}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invalid comparison data</Text>
        </View>
      </SafeAreaView>
    );
  }

  const [scan1, scan2] = scans;

  const renderComparisonHeader = () => (
    <View style={styles.comparisonHeader}>
      <View style={styles.itemColumn}>
        <Text style={styles.brandName}>{scan1.brand || 'Unknown'}</Text>
        <Text style={styles.itemName}>{scan1.itemType || 'Garment'}</Text>
        <GradeIndicator grade={scan1.grade || 'C'} size="medium" />
        <Text style={styles.scoreText}>{scan1.score || 0}/100</Text>
      </View>
      <View style={styles.vsContainer}>
        <Text style={styles.vsText}>VS</Text>
      </View>
      <View style={styles.itemColumn}>
        <Text style={styles.brandName}>{scan2.brand || 'Unknown'}</Text>
        <Text style={styles.itemName}>{scan2.itemType || 'Garment'}</Text>
        <GradeIndicator grade={scan2.grade || 'C'} size="medium" />
        <Text style={styles.scoreText}>{scan2.score || 0}/100</Text>
      </View>
    </View>
  );

  const renderMetricComparison = (label, value1, value2, unit, lowerIsBetter = true) => {
    const num1 = parseFloat(value1) || 0;
    const num2 = parseFloat(value2) || 0;
    
    let winner = null;
    if (num1 !== num2) {
      if (lowerIsBetter) {
        winner = num1 < num2 ? 1 : 2;
      } else {
        winner = num1 > num2 ? 1 : 2;
      }
    }

    return (
      <View style={styles.metricRow}>
        <View style={[styles.metricValue, winner === 1 && styles.winnerMetric]}>
          <Text style={[styles.valueText, winner === 1 && styles.winnerText]}>
            {num1.toFixed(2)}{unit}
          </Text>
          {winner === 1 && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
        </View>
        <View style={styles.metricLabel}>
          <Text style={styles.labelText}>{label}</Text>
        </View>
        <View style={[styles.metricValue, winner === 2 && styles.winnerMetric]}>
          <Text style={[styles.valueText, winner === 2 && styles.winnerText]}>
            {num2.toFixed(2)}{unit}
          </Text>
          {winner === 2 && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
        </View>
      </View>
    );
  };

  const renderFiberComparison = () => {
    const fibers1 = scan1.fibers || [];
    const fibers2 = scan2.fibers || [];
    const maxLength = Math.max(fibers1.length, fibers2.length);

    return (
      <View style={styles.fiberSection}>
        <Text style={styles.sectionTitle}>Fiber Composition</Text>
        <View style={styles.fiberContainer}>
          <View style={styles.fiberColumn}>
            {fibers1.map((fiber, index) => (
              <View key={index} style={styles.fiberItem}>
                <View style={[styles.fiberBar, { width: `${fiber.percentage}%` }]}>
                  <Text style={styles.fiberBarText} numberOfLines={1}>
                    {fiber.name}
                  </Text>
                </View>
                <Text style={styles.fiberPercentage}>{fiber.percentage}%</Text>
              </View>
            ))}
            {fibers1.length === 0 && (
              <Text style={styles.noFibers}>No fiber data</Text>
            )}
          </View>
          <View style={styles.fiberColumn}>
            {fibers2.map((fiber, index) => (
              <View key={index} style={styles.fiberItem}>
                <Text style={styles.fiberPercentage}>{fiber.percentage}%</Text>
                <View style={[styles.fiberBar, styles.fiberBarRight, { width: `${fiber.percentage}%` }]}>
                  <Text style={styles.fiberBarText} numberOfLines={1}>
                    {fiber.name}
                  </Text>
                </View>
              </View>
            ))}
            {fibers2.length === 0 && (
              <Text style={styles.noFibers}>No fiber data</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderWinner = () => {
    const score1 = scan1.score || 0;
    const score2 = scan2.score || 0;

    if (score1 === score2) {
      return (
        <View style={styles.winnerSection}>
          <Text style={styles.winnerTitle}>It's a Tie!</Text>
          <Text style={styles.winnerSubtext}>Both items have equal sustainability scores</Text>
        </View>
      );
    }

    const winner = score1 > score2 ? scan1 : scan2;
    const diff = Math.abs(score1 - score2);

    return (
      <View style={styles.winnerSection}>
        <LinearGradient
          colors={[colors.secondary, colors.primary]}
          style={styles.winnerBanner}
        >
          <Text style={styles.winnerTitle}>More Sustainable Choice</Text>
          <Text style={styles.winnerName}>{winner.brand || 'Unknown'}</Text>
          <Text style={styles.winnerSubtext}>
            {diff} points higher sustainability score
          </Text>
        </LinearGradient>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
          <View style={styles.backRow}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Back to History</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Item Comparison</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {renderComparisonHeader()}
        
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>Environmental Impact</Text>
          {renderMetricComparison('Water Usage', scan1.water_usage_liters, scan2.water_usage_liters, 'L', true)}
          {renderMetricComparison('Carbon Footprint', scan1.carbon_footprint_kg, scan2.carbon_footprint_kg, 'kg', true)}
          {renderMetricComparison('Sustainability Score', scan1.score, scan2.score, '', false)}
        </View>

        {renderFiberComparison()}
        {renderWinner()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
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
  title: {
    ...typography.h1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  brandName: {
    ...typography.body,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  itemName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  scoreText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  vsContainer: {
    paddingHorizontal: spacing.md,
  },
  vsText: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '900',
  },
  metricsSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  metricValue: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  winnerMetric: {
    backgroundColor: colors.primaryLight,
  },
  valueText: {
    ...typography.body,
    fontWeight: '600',
  },
  winnerText: {
    color: colors.primary,
  },
  winnerBadge: {
    color: colors.primary,
    fontSize: 20,
    marginTop: spacing.xs,
  },
  metricLabel: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  labelText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fiberSection: {
    marginBottom: spacing.xl,
  },
  fiberContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fiberColumn: {
    flex: 1,
  },
  fiberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  fiberBar: {
    backgroundColor: colors.info,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 40,
    maxWidth: '75%',
    overflow: 'hidden',
  },
  fiberBarRight: {
    backgroundColor: colors.accent,
  },
  fiberBarText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  fiberPercentage: {
    ...typography.caption,
    color: colors.textSecondary,
    minWidth: 40,
    textAlign: 'center',
  },
  noFibers: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  winnerSection: {
    marginTop: spacing.lg,
  },
  winnerBanner: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  winnerEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  winnerTitle: {
    ...typography.h2,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  winnerName: {
    ...typography.h3,
    color: '#FFFFFF',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  winnerSubtext: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
});

export default ComparisonScreen;
