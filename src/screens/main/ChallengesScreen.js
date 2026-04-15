// author: caitriona mccann
// date: 09/02/2026
// challenges and achievements screen - gamification hub
// shows active challenges, achievements progress, and unlocked badges

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { fetchAchievements, fetchChallenges, joinChallenge, shareAchievement } from '../../services/api';

const ChallengesScreen = () => {
  const navigation = useNavigation();
  const { isGuest } = useAuth();
  const { showAlert } = useAlert();

  const [activeTab, setActiveTab] = useState('challenges');
  const [challenges, setChallenges] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  const normalizeChallenge = (challenge) => ({
    ...challenge,
    title: challenge.title,
    description: challenge.description,
    challenge_type: challenge.challenge_type || challenge.goalType || challenge.goal_type || challenge.type,
    target_value: challenge.target_value ?? challenge.goalValue ?? challenge.goal_value ?? 1,
    reward_points: challenge.reward_points ?? challenge.points ?? 0,
    user_progress: challenge.user_progress ?? challenge.progress ?? 0,
    is_joined: challenge.is_joined ?? challenge.joined ?? Boolean(challenge.user_challenge_id),
    end_date: challenge.end_date || challenge.endsAt || challenge.ends_at,
  });

  const normalizeAchievement = (achievement) => ({
    ...achievement,
    name: achievement.name || achievement.title,
    user_progress: achievement.user_progress ?? achievement.progress ?? 0,
    is_unlocked: achievement.is_unlocked ?? achievement.unlocked ?? false,
  });

  useFocusEffect(
    useCallback(() => {
      if (!isGuest) {
        loadData();
      } else {
        setLoading(false);
      }
    }, [isGuest])
  );

  const loadData = async () => {
    setLoading(true);
    const [challengeResult, achievementResult] = await Promise.all([
      fetchChallenges(),
      fetchAchievements(),
    ]);
    if (challengeResult.success) {
      setChallenges((challengeResult.challenges || []).map(normalizeChallenge));
    } else {
      setChallenges([]);
    }
    if (achievementResult.success) {
      setAchievements((achievementResult.achievements || []).map(normalizeAchievement));
    } else {
      setAchievements([]);
    }
    setLoading(false);
  };

  const handleJoinChallenge = async (challengeId) => {
    const result = await joinChallenge(challengeId);
    if (result.success) {
      showAlert('Joined!', 'Challenge accepted! Start scanning to make progress.');
      loadData();
    } else {
      showAlert('Error', result.error || 'Failed to join challenge');
    }
  };

  const handleShareAchievement = async (achievementId) => {
    const result = await shareAchievement(achievementId);
    if (result.success) {
      showAlert('Shared!', 'Your achievement has been posted to the community feed.');
    } else {
      showAlert('Error', result.error || 'Failed to share achievement');
    }
  };

  const getDaysRemaining = (endDate) => {
    if (!endDate) return 0;
    const now = new Date();
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return 0;
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'scanning': return 'scan-outline';
      case 'social': return 'people-outline';
      case 'sustainability': return 'leaf-outline';
      case 'streak': return 'flame-outline';
      default: return 'star-outline';
    }
  };

  const getAchievementIcon = (achievement, isUnlocked) => {
    if (!isUnlocked) return 'lock-closed-outline';

    switch (achievement.category) {
      case 'scanning': return 'scan-outline';
      case 'social': return 'people-outline';
      case 'sustainability': return 'leaf-outline';
      case 'streak': return 'flame-outline';
      default: return 'star-outline';
    }
  };

  const renderChallenges = () => (
    <View>
      {challenges.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Active Challenges</Text>
          <Text style={styles.emptyText}>Check back later for new sustainability challenges!</Text>
        </Card>
      ) : (
        challenges.map((challenge) => {
          const daysLeft = getDaysRemaining(challenge.end_date);
          const progress = challenge.user_progress || 0;
          const target = challenge.target_value || 1;
          const progressPct = Math.min(100, (progress / target) * 100);
          const isJoined = challenge.is_joined;

          return (
            <Card key={challenge.id} style={styles.challengeCard}>
              <View style={styles.challengeHeader}>
                <View style={styles.challengeType}>
                  <Ionicons name={challenge.challenge_type === 'scan_count' ? 'scan-outline' : 'leaf-outline'} size={20} color={colors.primary} />
                </View>
                <View style={styles.challengeInfo}>
                  <Text style={styles.challengeTitle}>{challenge.title}</Text>
                  <Text style={styles.challengeDesc}>{challenge.description}</Text>
                </View>
                <View style={styles.daysContainer}>
                  <Text style={styles.daysNumber}>{daysLeft}</Text>
                  <Text style={styles.daysLabel}>days left</Text>
                </View>
              </View>

              {/* Progress Bar */}
              {isJoined && (
                <View style={styles.progressSection}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {progress}/{target} ({progressPct.toFixed(0)}%)
                  </Text>
                </View>
              )}

              {/* Reward */}
              <View style={styles.rewardRow}>
                <Text style={styles.rewardLabel}>Reward: {challenge.reward_points} points</Text>
              </View>

              {/* Action */}
              {!isJoined ? (
                <TouchableOpacity
                  style={styles.joinButton}
                  onPress={() => handleJoinChallenge(challenge.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Join ${challenge.name}`}
                  accessibilityHint="Adds this challenge to your active challenges"
                >
                  <Text style={styles.joinText}>Join Challenge</Text>
                </TouchableOpacity>
              ) : progressPct >= 100 ? (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedText}>Done!</Text>
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </View>
  );

  // group achievements by category
  const groupedAchievements = achievements.reduce((acc, a) => {
    const cat = a.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  const renderAchievements = () => (
    <View>
      {Object.keys(groupedAchievements).length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Achievements Yet</Text>
          <Text style={styles.emptyText}>Start scanning to unlock achievements!</Text>
        </Card>
      ) : (
        Object.entries(groupedAchievements).map(([category, items]) => (
          <View key={category}>
            <View style={styles.categoryTitleRow}>
              <Ionicons name={getCategoryIcon(category)} size={18} color={colors.primary} />
              <Text style={styles.categoryTitle}>{category.charAt(0).toUpperCase() + category.slice(1)}</Text>
            </View>
            {items.map((achievement) => {
              const progress = achievement.user_progress || 0;
              const target = achievement.threshold || 1;
              const progressPct = Math.min(100, (progress / target) * 100);
              const isUnlocked = achievement.is_unlocked;

              return (
                <Card
                  key={achievement.id}
                  style={[styles.achievementCard, !isUnlocked && styles.achievementLocked]}
                >
                  <View style={styles.achievementHeader}>
                    <View style={[styles.achievementIconBox, !isUnlocked && styles.achievementIconBoxLocked]}>
                      <Ionicons
                        name={getAchievementIcon(achievement, isUnlocked)}
                        size={20}
                        color={isUnlocked ? colors.primary : colors.textTertiary}
                      />
                    </View>
                    <View style={styles.achievementInfo}>
                      <Text style={[styles.achievementTitle, !isUnlocked && styles.lockedText]}>
                        {achievement.name}
                      </Text>
                      <Text style={styles.achievementDesc}>{achievement.description}</Text>
                    </View>
                    {isUnlocked && (
                      <Text style={styles.achievementPoints}>+{achievement.points}pts</Text>
                    )}
                  </View>

                  {/* Progress */}
                  {!isUnlocked && (
                    <View style={styles.progressSection}>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                      </View>
                      <Text style={styles.progressText}>
                        {progress}/{target}
                      </Text>
                    </View>
                  )}

                  {/* Share unlocked achievements */}
                  {isUnlocked && (
                    <TouchableOpacity
                      style={styles.shareButton}
                      onPress={() => handleShareAchievement(achievement.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Share ${achievement.name} achievement to feed`}
                    >
                      <Text style={styles.shareText}>Share to Feed</Text>
                    </TouchableOpacity>
                  )}
                </Card>
              );
            })}
          </View>
        ))
      )}
    </View>
  );

  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <View style={styles.backRow}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </View>
          </TouchableOpacity>
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sign In Required</Text>
            <Text style={styles.emptyText}>
              Create an account to participate in challenges and earn achievements.
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading challenges...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <View style={styles.backRow}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </View>
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">Challenges & Achievements</Text>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'challenges' && styles.tabActive]}
            onPress={() => setActiveTab('challenges')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'challenges' }}
            accessibilityLabel="Challenges"
          >
            <Text style={[styles.tabText, activeTab === 'challenges' && styles.tabTextActive]}>
              Challenges
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'achievements' && styles.tabActive]}
            onPress={() => setActiveTab('achievements')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'achievements' }}
            accessibilityLabel="Achievements"
          >
            <Text style={[styles.tabText, activeTab === 'achievements' && styles.tabTextActive]}>
              Achievements
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Links */}
        <TouchableOpacity
          style={styles.leaderboardLink}
          onPress={() => navigation.navigate('Leaderboard')}
          accessibilityRole="link"
          accessibilityLabel="View leaderboard"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.leaderboardLinkText}>View Leaderboard</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {activeTab === 'challenges' ? renderChallenges() : renderAchievements()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  scrollContent: {
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
    ...typography.h2,
    marginBottom: spacing.lg,
    includeFontPadding: false,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.background,
    fontWeight: '600',
  },
  leaderboardLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
  },
  leaderboardLinkText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  // challenges
  challengeCard: {
    marginBottom: spacing.md,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  challengeType: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  challengeTypeText: {
    fontSize: 20,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 2,
  },
  challengeDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  daysContainer: {
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  daysNumber: {
    ...typography.h3,
    color: colors.primary,
  },
  daysLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  progressSection: {
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'right',
  },
  rewardRow: {
    marginBottom: spacing.sm,
  },
  rewardLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  joinText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
  completedBadge: {
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  completedText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  // achievements
  categoryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, marginBottom: spacing.sm },
  categoryTitle: {
    ...typography.h3,
  },
  achievementCard: {
    marginBottom: spacing.sm,
  },
  achievementLocked: {
    opacity: 0.7,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  achievementIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  achievementIconBoxLocked: {
    backgroundColor: colors.surfaceSecondary,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  lockedText: {
    color: colors.textTertiary,
  },
  achievementDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  achievementPoints: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  shareButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  shareText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  // empty states
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
});

export default ChallengesScreen;
