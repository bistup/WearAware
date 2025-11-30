// author: caitriona mccann
// date: 28/11/2025
// profile screen showing account info and logout button
// shows if you're in guest mode too

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { colors, typography, spacing } from '../../theme/theme';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout, isGuest } = useAuth();

  // confirm before logging out
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout(); // firebase sign out
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Profile</Text>

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
            <Text style={styles.infoText}>
              You're using guest mode. Your scan history is stored locally and will be
              lost if you uninstall the app.
            </Text>
          </Card>
        )}

        <Button title="Logout" onPress={handleLogout} variant="secondary" />
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
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
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
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.lg,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default ProfileScreen;


