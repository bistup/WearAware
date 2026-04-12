// author: caitriona mccann
// date: 09/02/2026
// leaderboard screen - shows top users ranked by sustainability score
// supports weekly, monthly, and all-time periods

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { fetchLeaderboard } from '../../services/api';

const PERIODS = [
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'alltime', label: 'All Time' },
];

const LeaderboardScreen = () => {
  const navigation = useNavigation();
  const { user, isGuest } = useAuth();

  const [period, setPeriod] = useState('weekly');
  const [entries, setEntries] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [loading, setLoading] = useState(true);

  const normalizeEntry = (entry = {}) => ({
    rank: entry.rank,
    firebase_uid: entry.firebase_uid || entry.firebaseUid,
    email: entry.email,
    display_name: entry.display_name || entry.displayName,
    avatar_url: entry.avatar_url || entry.avatarUrl,
    total_scans: entry.total_scans ?? entry.scanCount ?? entry.scan_count ?? 0,
    avg_score: entry.avg_score ?? entry.avgScore ?? 0,
    achievement_points: entry.achievement_points ?? entry.achievementPoints ?? 0,
    total_score: entry.total_score ?? entry.totalScore ?? entry.achievement_points ?? entry.achievementPoints ?? 0,
  });

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  const loadLeaderboard = async () => {
    setLoading(true);
    const result = await fetchLeaderboard(period);
    if (result.success) {
      const normalizedEntries = (result.leaderboard || []).map(normalizeEntry);
      setEntries(normalizedEntries);
      setCurrentUserRank(result.currentUserRank ? normalizeEntry(result.currentUserRank) : null);
    }
    setLoading(false);
  };

  const getMedalEmoji = (rank) => {
    switch (rank) {
      case 1: return '1st';
      case 2: return '2nd';
      case 3: return '3rd';
      default: return null;
    }
  };

  const renderItem = ({ item, index }) => {
    const rank = index + 1;
    const medal = getMedalEmoji(rank);
    const isCurrentUser = user && item.firebase_uid === user.uid;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('SocialProfile', { firebaseUid: item.firebase_uid })}
        activeOpacity={0.7}
      >
        <Card style={[styles.entryCard, isCurrentUser && styles.currentUserCard]}>
          <View style={styles.rankContainer}>
            {medal ? (
              <View style={[styles.medalBadge, { backgroundColor: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32' }]}>
                <Text style={styles.medalText}>{rank}</Text>
              </View>
            ) : (
              <Text style={styles.rankNumber}>{rank}</Text>
            )}
          </View>

          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, rank <= 3 && styles.topAvatar]}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {(item.display_name || item.email || '?')[0].toUpperCase()}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.display_name || item.email?.split('@')[0] || 'User'}
              {isCurrentUser ? ' (You)' : ''}
            </Text>
            <Text style={styles.userStats}>
              {item.total_scans || 0} scans · Avg {Number(item.avg_score || 0).toFixed(0)}/100
            </Text>
          </View>

          <View style={styles.scoreContainer}>
            <Text style={styles.totalScore}>{Number(item.total_score || 0).toFixed(0)}</Text>
            <Text style={styles.scoreLabel}>pts</Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <View style={styles.backRow}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.title}>Leaderboard</Text>
      <Text style={styles.subtitle}>Top sustainability champions</Text>

      {/* Period Selector */}
      <View style={styles.periodContainer}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodButton, period === p.key && styles.periodButtonActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Current User Rank */}
      {currentUserRank && !isGuest && (
        <Card style={styles.myRankCard}>
          <Text style={styles.myRankLabel}>Your Rank</Text>
          <View style={styles.myRankRow}>
            <Text style={styles.myRankNumber}>#{currentUserRank.rank}</Text>
            <Text style={styles.myRankScore}>
              {Number(currentUserRank.total_score || 0).toFixed(0)} points
            </Text>
          </View>
        </Card>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No Rankings Yet</Text>
        <Text style={styles.emptyText}>
          Start scanning to earn points and climb the leaderboard!
        </Text>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, index) => item.firebase_uid || index.toString()}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          accessibilityLabel="Sustainability leaderboard"
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
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
  periodContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  periodTextActive: {
    color: colors.background,
    fontWeight: '600',
  },
  myRankCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  myRankLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  myRankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  myRankNumber: {
    ...typography.h2,
    color: colors.primary,
  },
  myRankScore: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  entryCard: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentUserCard: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  medalEmoji: {
    fontSize: 24,
  },
  medalBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  medalText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  rankNumber: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  avatarContainer: {
    marginRight: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  topAvatar: {
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...typography.body,
    fontWeight: '600',
  },
  userStats: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  totalScore: {
    ...typography.h3,
    color: colors.primary,
  },
  scoreLabel: {
    ...typography.caption,
    color: colors.textTertiary,
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
  },
});

export default LeaderboardScreen;
