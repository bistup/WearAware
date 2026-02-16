// author: caitriona mccann
// date: 09/02/2026
// challenges and achievements screen - gamification hub
// shows active challenges, achievements progress, and unlocked badges

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { fetchAchievements, fetchChallenges, joinChallenge, shareAchievement } from '../../services/api';

const ChallengesScreen = () => {
  const navigation = useNavigation();
  const { isGuest } = useAuth();

  const [activeTab, setActiveTab] = useState('challenges');
  const [challenges, setChallenges] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (challengeResult.success) setChallenges(challengeResult.challenges || []);
    if (achievementResult.success) setAchievements(achievementResult.achievements || []);
    setLoading(false);
  };

  const handleJoinChallenge = async (challengeId) => {
    const result = await joinChallenge(challengeId);
    if (result.success) {
      Alert.alert('Joined!', 'Challenge accepted! Start scanning to make progress.');
      loadData();
    } else {
      Alert.alert('Error', result.error || 'Failed to join challenge');
    }
  };

  const handleShareAchievement = async (achievementId) => {
    const result = await shareAchievement(achievementId);
    if (result.success) {
      Alert.alert('Shared!', 'Your achievement has been posted to the community feed.');
    } else {
      Alert.alert('Error', result.error || 'Failed to share achievement');
    }
  };

  const getDaysRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'scanning': return '';
      case 'social': return '';
      case 'sustainability': return '';
      case 'streak': return '';
      default: return '';
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
                  <Text style={styles.challengeTypeText}>
                    {challenge.challenge_type === 'scan_count' ? 'Scan' : 'Eco'}
                  </Text>
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
            <Text style={styles.categoryTitle}>
              {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>
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
                    <Text style={styles.achievementIcon}>
                      {isUnlocked ? achievement.icon || '' : ''}
                    </Text>
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
            <Text style={styles.backText}>← Back</Text>
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
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Challenges & Achievements</Text>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'challenges' && styles.tabActive]}
            onPress={() => setActiveTab('challenges')}
          >
            <Text style={[styles.tabText, activeTab === 'challenges' && styles.tabTextActive]}>
              Challenges
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'achievements' && styles.tabActive]}
            onPress={() => setActiveTab('achievements')}
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
        >
          <Text style={styles.leaderboardLinkText}>View Leaderboard →</Text>
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
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.lg,
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
  categoryTitle: {
    ...typography.h3,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
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
  achievementIcon: {
    fontSize: 28,
    marginRight: spacing.md,
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
