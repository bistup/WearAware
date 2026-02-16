// author: caitriona mccann
// date: 27/11/2025
// last updated: 10/02/2026
// home screen - clean white design with green accents
// quick actions, sustainability tip, community section
// view-based icons, no emojis

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/theme';

// simple view-based icons
const ScanIcon = () => (
  <View style={iconStyles.scanIcon}>
    <View style={iconStyles.scanFrame}>
      <View style={[iconStyles.scanCorner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
      <View style={[iconStyles.scanCorner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
      <View style={[iconStyles.scanCorner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
      <View style={[iconStyles.scanCorner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
      <View style={iconStyles.scanRect} />
    </View>
  </View>
);

const EditIcon = () => (
  <View style={iconStyles.editIcon}>
    <View style={iconStyles.tagShape} />
    <View style={iconStyles.tagHole} />
  </View>
);

const LeafLogo = () => (
  <View style={iconStyles.logoContainer}>
    <View style={iconStyles.logoCircle}>
      <Text style={iconStyles.logoTextW}>W</Text>
      <Text style={iconStyles.logoTextA}>A</Text>
    </View>
  </View>
);

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user, isGuest } = useAuth();

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <LeafLogo />
            <Text style={styles.appName}>WearAware</Text>
          </View>
        </View>

        {/* Welcome */}
        <Text style={styles.greeting}>
          {isGuest ? 'Welcome, Guest' : `Welcome back`}
        </Text>
        <Text style={styles.greetingSub}>
          Scan a clothing label to check its environmental impact
        </Text>

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
            <View style={styles.primaryActionIcon}>
              <ScanIcon />
            </View>
            <Text style={styles.primaryActionTitle}>Scan Label</Text>
            <Text style={styles.primaryActionDesc}>
              Use your camera to scan clothing labels
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => navigation.navigate('ManualInput')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Manual entry"
            accessibilityHint="Enter garment details manually"
          >
            <View style={styles.secondaryActionIcon}>
              <EditIcon />
            </View>
            <View style={styles.secondaryActionText}>
              <Text style={styles.secondaryActionTitle}>Manual Entry</Text>
              <Text style={styles.secondaryActionDesc}>Enter details manually</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Sustainability Tip */}
        <Card style={styles.tipCard}>
          <Text style={styles.tipLabel}>Sustainability Tip</Text>
          <Text style={styles.tipText}>{randomTip}</Text>
        </Card>

        {/* Community Section */}
        <Text style={styles.sectionTitle}>Explore</Text>
        <View style={styles.exploreGrid}>
          <TouchableOpacity
            style={styles.exploreCard}
            onPress={() => navigation.navigate('Challenges')}
            accessibilityRole="button"
            accessibilityLabel="Challenges"
          >
            <View style={styles.exploreIconBox}>
              <Text style={styles.exploreIconText}>CH</Text>
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
              <Text style={styles.exploreIconText}>LB</Text>
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
              <Text style={styles.exploreIconText}>WL</Text>
            </View>
            <Text style={styles.exploreLabel}>Wishlist</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  appName: {
    ...typography.h2,
    color: colors.primary,
    letterSpacing: 0.5,
    fontWeight: '800',
  },
  greeting: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  greetingSub: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  // quick actions
  quickActions: {
    marginBottom: spacing.lg,
  },
  primaryAction: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.glow,
  },
  primaryActionIcon: {
    marginBottom: spacing.md,
  },
  primaryActionTitle: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  primaryActionDesc: {
    ...typography.body,
    color: colors.textSecondary,
  },
  secondaryAction: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryActionIcon: {
    marginRight: spacing.md,
  },
  secondaryActionText: {
    flex: 1,
  },
  secondaryActionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  secondaryActionDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  // tip card
  tipCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface,
  },
  tipLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
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
    marginBottom: spacing.lg,
  },
  exploreCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  exploreIconBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  exploreIconText: {
    ...typography.bodySmall,
    fontWeight: '800',
    color: colors.primary,
  },
  exploreLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

const iconStyles = StyleSheet.create({
  scanIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 36,
    height: 36,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderColor: colors.primary,
    borderRadius: 2,
  },
  scanRect: {
    position: 'absolute',
    width: 16,
    height: 10,
    backgroundColor: colors.primary,
    borderRadius: 2,
    top: 13,
    left: 10,
  },
  editIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  tagShape: {
    width: 28,
    height: 34,
    backgroundColor: colors.primary,
    borderRadius: 6,
    transform: [{ rotate: '-15deg' }],
  },
  tagHole: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    top: 10,
    left: 16,
    transform: [{ rotate: '-15deg' }],
  },
  logoContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  logoTextW: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.background,
    letterSpacing: -2,
  },
  logoTextA: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.background,
    letterSpacing: -2,
  },
});

export default HomeScreen;


