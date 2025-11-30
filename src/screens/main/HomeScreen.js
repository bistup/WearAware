// author: caitriona mccann
// date: 27/11/2025
// home screen with all the main actions - scan label, manual entry, history, profile
// has the custom icons i made to match the nature vibe

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';

// Eco-friendly icon components
const CameraIcon = () => (
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
    <View style={iconStyles.tagString} />
  </View>
);

const HistoryIcon = () => (
  <View style={iconStyles.historyIcon}>
    <View style={iconStyles.clockCircle} />
    <View style={iconStyles.clockHand1} />
    <View style={iconStyles.clockHand2} />
    <View style={iconStyles.clockCenter} />
  </View>
);

const ProfileIcon = () => (
  <View style={iconStyles.profileIcon}>
    <View style={iconStyles.personHead} />
    <View style={iconStyles.personBody} />
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

  const ActionCard = ({ title, description, onPress, IconComponent }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.actionCard}>
        <View style={styles.iconContainer}>
          <IconComponent />
        </View>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <LeafLogo />
            <Text style={styles.appName}>WearAware</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.profileButton}
          >
            <ProfileIcon />
          </TouchableOpacity>
        </View>

        <Card style={styles.tipCard}>
          <Text style={styles.tipLabel}>💡 Sustainability Tip</Text>
          <Text style={styles.tipText}>{randomTip}</Text>
        </Card>

        <View style={styles.actions}>
          <ActionCard
            title="Scan Label"
            description="Use camera to scan clothing care labels"
            IconComponent={CameraIcon}
            onPress={() => navigation.navigate('Camera')}
          />
          <ActionCard
            title="Manual Entry"
            description="Enter clothing details manually"
            IconComponent={EditIcon}
            onPress={() => navigation.navigate('ManualInput')}
          />
          <ActionCard
            title="Scan History"
            description="View your previous scans"
            IconComponent={HistoryIcon}
            onPress={() => navigation.navigate('History')}
          />
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
    marginBottom: spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  appName: {
    ...typography.h2,
    color: colors.primary,
    letterSpacing: 1,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  tipLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  tipText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
  },
  actionCard: {
    marginBottom: spacing.md,
  },
  iconContainer: {
    marginBottom: spacing.md,
    height: 48,
    justifyContent: 'center',
  },
  actionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  actionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});

const iconStyles = StyleSheet.create({
  // Scan Icon (Scanning frame with rectangle)
  scanIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
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
  
  // Edit Icon (Clothing tag)
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
    borderRadius: 4,
    transform: [{ rotate: '-15deg' }],
  },
  tagHole: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    top: 10,
    left: 16,
    transform: [{ rotate: '-15deg' }],
  },
  tagString: {
    position: 'absolute',
    width: 2,
    height: 10,
    backgroundColor: colors.primary + 'DD',
    top: 5,
    left: 18,
    borderRadius: 1,
    transform: [{ rotate: '-15deg' }],
  },
  
  // History Icon (Clock)
  historyIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  clockCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  clockHand1: {
    position: 'absolute',
    width: 3,
    height: 12,
    backgroundColor: colors.primary,
    top: 9,
    left: 20.5,
    borderRadius: 1.5,
  },
  clockHand2: {
    position: 'absolute',
    width: 11,
    height: 3,
    backgroundColor: colors.primary,
    top: 20.5,
    left: 22,
    borderRadius: 1.5,
  },
  clockCenter: {
    position: 'absolute',
    width: 5,
    height: 5,
    backgroundColor: colors.primary,
    borderRadius: 2.5,
    top: 19.5,
    left: 19.5,
  },
  
  // Profile Icon (Person)
  profileIcon: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginBottom: 2,
  },
  personBody: {
    width: 16,
    height: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: colors.primary,
  },
  
  // Logo (W + A combined)
  logoContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  logoTextW: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  logoTextA: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
});

export default HomeScreen;


