// author: caitriona mccann
// date: 09/02/2026
// follower/following list screen - shows followers or following users
// allows unfollowing and navigating to profiles

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { fetchFollowers, fetchFollowing } from '../../services/api';

const FollowerListScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { firebaseUid, type } = route.params || {};
  const isFollowers = type === 'followers';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      if (!firebaseUid) {
        setUsers([]);
        setError('Unable to load this list right now.');
        setLoading(false);
        return;
      }
      loadUsers();
    }, [firebaseUid, type])
  );

  const loadUsers = async () => {
    if (!firebaseUid) return;
    setLoading(true);
    setError('');
    try {
      const result = isFollowers
        ? await fetchFollowers(firebaseUid)
        : await fetchFollowing(firebaseUid);

      if (result.success) {
        setUsers(isFollowers ? (result.followers || []) : (result.following || []));
      } else {
        setUsers([]);
        setError(result.error || 'Failed to load users.');
      }
    } catch (err) {
      console.error('Failed to load followers/following:', err);
      setUsers([]);
      setError('Failed to load users.');
    }
    setLoading(false);
  };

  const renderUser = ({ item }) => {
    const name = item.display_name || item.email?.split('@')[0] || 'User';
    const avatarUrl = item.avatar_url || null;
    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => navigation.push('SocialProfile', { firebaseUid: item.firebase_uid })}
      >
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        {item.sustainability_score > 0 && (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>{item.sustainability_score}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
          <View style={styles.backRow}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>
          {isFollowers ? 'Followers' : 'Following'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.firebase_uid}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={isFollowers ? 'people-outline' : 'person-add-outline'}
                size={48}
                color={colors.textTertiary}
                style={{ marginBottom: spacing.md }}
              />
              <Text style={styles.emptyTitle}>
                {isFollowers ? 'No followers yet' : 'Not following anyone yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {isFollowers
                  ? 'When people follow this account, they\'ll appear here'
                  : 'When this account follows someone, they\'ll appear here'}
              </Text>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    ...typography.h2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.full,
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...typography.body,
    fontWeight: '600',
  },
  userEmail: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  scoreBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  scoreText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default FollowerListScreen;
