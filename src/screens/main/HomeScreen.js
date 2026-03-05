// author: caitriona mccann
// date: 27/11/2025
// last updated: 04/03/2026
// home screen - clean light design with green accents
// quick actions, sustainability tip, community section
// uses ionicons for proper icons

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/theme';

const HomeScreen = () => {
  const navigation = useNavigation();

  const sustainabilityTips = [
    "Natural fibers like cotton and linen are biodegradable",
    "Washing clothes in cold water saves energy and extends fabric life",
    "One cotton t-shirt uses 2,700 liters of water to produce",
    "Polyester takes 200+ years to decompose in landfills",
    "Buying second-hand reduces fashion's carbon footprint by 82%",
  ];

  const randomTip = sustainabilityTips[Math.floor(Math.random() * sustainabilityTips.length)];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <View style={styles.logoBox}>
              <Ionicons name="leaf" size={22} color={colors.background} />
            </View>
            <View>
              <Text style={styles.appName}>WearAware</Text>
              <Text style={styles.appTagline}>Sustainable Scan Assistant</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.navigate('Camera')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Scan a label"
            accessibilityHint="Open the camera to scan a clothing care label"
          >
            <View style={[styles.actionIconBase, styles.primaryActionIcon]}>
              <Ionicons name="camera" size={30} color={colors.background} />
            </View>
            <Text style={styles.primaryActionTitle}>Scan Label</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => navigation.navigate('ManualInput')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Manual entry"
            accessibilityHint="Enter garment details manually"
          >
            <View style={[styles.actionIconBase, styles.secondaryActionIcon]}>
              <Ionicons name="reader-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.secondaryActionTitle}>Manual Entry</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Sustainability Tip */}
        <Card style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Ionicons name="leaf-outline" size={16} color={colors.primary} />
            <Text style={styles.tipLabel}>Sustainability Tip</Text>
          </View>
          <Text style={styles.tipText}>{randomTip}</Text>
        </Card>

        {/* Explore Section */}
        <Text style={styles.sectionTitle}>Explore</Text>
        <View style={styles.exploreGrid}>
          <TouchableOpacity
            style={styles.exploreCard}
            onPress={() => navigation.navigate('Challenges')}
            accessibilityRole="button"
            accessibilityLabel="Challenges"
          >
            <View style={styles.exploreIconBox}>
              <Ionicons name="trophy-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.exploreLabel}>Challenges</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exploreCard}
            onPress={() => navigation.navigate('Leaderboard')}
            accessibilityRole="button"
            accessibilityLabel="Leaderboard"
          >
            <View style={styles.exploreIconBox}>
              <Ionicons name="podium-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.exploreLabel}>Leaderboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exploreCard}
            onPress={() => navigation.navigate('Wishlist')}
            accessibilityRole="button"
            accessibilityLabel="Wishlist"
          >
            <View style={styles.exploreIconBox}>
              <Ionicons name="heart-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.exploreLabel}>Wishlist</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  // header
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '800',
  },
  appTagline: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  // quick actions
  quickActions: {
    marginBottom: spacing.md,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    height: 250,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    borderWidth: 0,
    ...shadows.soft,
  },
  actionIconBase: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionIcon: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  primaryActionTitle: {
    ...typography.h2,
    color: colors.background,
  },
  secondaryAction: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  secondaryActionIcon: {
    backgroundColor: colors.primaryLight,
    marginRight: spacing.md,
  },
  secondaryActionTitle: {
    ...typography.body,
    fontWeight: '700',
    flex: 1,
    includeFontPadding: false,
  },
  // tip card
  tipCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tipLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tipText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  // explore section
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  exploreGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exploreCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  exploreIconBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  exploreLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default HomeScreen;
