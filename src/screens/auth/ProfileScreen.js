// author: caitriona mccann
// date: 28/11/2025
// last updated: 10/02/2026
// profile screen - shows account info, social profile link, logout
// works as both tab destination and stack screen

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout, isGuest } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Profile</Text>

        {/* Avatar + Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar} accessibilityRole="image" accessibilityLabel={`${displayName} avatar`}>
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.label}>Account</Text>
          {isGuest ? (
            <Text style={styles.value}>Guest User</Text>
          ) : (
            <Text style={styles.value}>{user?.email}</Text>
          )}
        </Card>

        {isGuest && (
          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>Guest Mode</Text>
            <Text style={styles.infoText}>
              Your scan history is stored locally and will be lost if you uninstall the app. Create an account to save your data.
            </Text>
          </Card>
        )}

        {!isGuest && (
          <>
            <Button
              title="View Social Profile"
              onPress={() => navigation.navigate('SocialProfile', { firebaseUid: user?.uid })}
              variant="secondary"
              style={styles.actionButton}
              accessibilityHint="View your public profile and posts"
            />
            <Button
              title="Edit Profile"
              onPress={() => navigation.navigate('EditProfile', { profile: { display_name: displayName, email: user?.email } })}
              variant="secondary"
              style={styles.actionButton}
              accessibilityHint="Edit your display name and bio"
            />
          </>
        )}

        <Button
          title="Logout"
          onPress={handleLogout}
          variant="secondary"
          style={styles.logoutButton}
          accessibilityHint="Sign out of your account"
        />
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.background,
  },
  displayName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  card: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.warningLight,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  infoTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
  logoutButton: {
    marginTop: spacing.lg,
    borderColor: colors.error,
  },
});

export default ProfileScreen;


