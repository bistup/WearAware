// author: caitriona mccann
// date: 09/02/2026
// social profile screen - shows another user's profile with stats, scans, follow button
// also doubles as the enhanced view for your own profile

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Card from '../../components/Card';
import Button from '../../components/Button';
import GradeIndicator from '../../components/GradeIndicator';
import FeedPostCard from '../../components/FeedPostCard';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, getGradeColor } from '../../theme/theme';
import {
  fetchUserProfile,
  followUser,
  unfollowUser,
  toggleLike,
  startConversation,
} from '../../services/api';

const SocialProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const targetUid = route.params?.firebaseUid || user?.uid;
  const isOwnProfile = targetUid === user?.uid;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messagingLoading, setMessagingLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [targetUid])
  );

  const loadProfile = async () => {
    setLoading(true);
    const result = await fetchUserProfile(targetUid);
    if (result.success) {
      setProfile(result.profile);
      setPosts(result.posts || []);
      setOutfits(result.outfits || []);
      setWardrobeItems(result.wardrobe || []);
      setFollowing(result.profile.is_following);
    }
    setLoading(false);
  };

  const handleFollow = async () => {
    setFollowLoading(true);
    const result = following
      ? await unfollowUser(targetUid)
      : await followUser(targetUid);

    if (result.success) {
      setFollowing(!following);
      // update follower count locally
      setProfile(prev => ({
        ...prev,
        follower_count: following
          ? Math.max(0, prev.follower_count - 1)
          : prev.follower_count + 1,
      }));
    }
    setFollowLoading(false);
  };

  const handleLike = async (postId) => {
    return await toggleLike(postId);
  };

  const handleComment = (postId) => {
    navigation.navigate('Comments', { postId });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
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
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = profile.display_name || profile.email?.split('@')[0] || 'User';
  const avgGrade = profile.avg_grade || 'C';
  const avgScore = profile.avg_score || 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
            <View style={styles.backRow}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarLargeImage} />
            ) : (
              <Text style={styles.avatarLargeText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          <Text style={styles.email}>{profile.email}</Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => navigation.navigate('FollowerList', {
                firebaseUid: targetUid, type: 'followers'
              })}
            >
              <Text style={styles.statValue}>{profile.follower_count || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => navigation.navigate('FollowerList', {
                firebaseUid: targetUid, type: 'following'
              })}
            >
              <Text style={styles.statValue}>{profile.following_count || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.total_scans || 0}</Text>
              <Text style={styles.statLabel}>Scans</Text>
            </View>
          </View>

          {/* Follow/Message Buttons */}
          {!isOwnProfile && (
            <View style={styles.profileActions}>
              <Button
                title={followLoading ? 'Loading...' : following ? 'Unfollow' : 'Follow'}
                onPress={handleFollow}
                variant={following ? 'secondary' : 'primary'}
                loading={followLoading}
                style={styles.followButton}
              />
              <TouchableOpacity
                style={[styles.messageBtn, messagingLoading && styles.messageBtnLoading]}
                disabled={messagingLoading}
                onPress={async () => {
                  setMessagingLoading(true);
                  const result = await startConversation(targetUid);
                  setMessagingLoading(false);
                  if (result.success) {
                    navigation.navigate('Chat', {
                      conversationId: result.conversationId,
                      otherUserName: displayName,
                      otherFirebaseUid: targetUid,
                      otherAvatarUrl: profile.avatar_url,
                    });
                  } else {
                    showAlert('Error', 'Could not open chat. Please try again.');
                  }
                }}
              >
                {messagingLoading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <>
                      <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
                      <Text style={styles.messageBtnText}>Message</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}
          {isOwnProfile && (
            <Button
              title="Edit Profile"
              onPress={() => navigation.navigate('EditProfile', { profile })}
              variant="secondary"
              style={styles.followButton}
            />
          )}
        </Card>

        {/* Sustainability Stats */}
        <Card style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Sustainability Stats</Text>
          <View style={styles.sustainabilityRow}>
            <View style={styles.gradeDisplay}>
              <GradeIndicator grade={avgGrade} size="medium" />
              <Text style={styles.gradeLabel}>Avg Grade</Text>
            </View>
            <View style={styles.sustainabilityDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Average Score</Text>
                <Text style={styles.detailValue}>{avgScore}/100</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Scans</Text>
                <Text style={styles.detailValue}>{profile.total_scans}</Text>
              </View>
              {profile.improvement_percentage !== 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>30-Day Trend</Text>
                  <Text style={[
                    styles.detailValue,
                    { color: profile.improvement_percentage > 0 ? colors.primary : colors.error }
                  ]}>
                    {profile.improvement_percentage > 0 ? '↑' : '↓'}
                    {Math.abs(profile.improvement_percentage)} pts
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Grade Distribution */}
          {profile.grade_distribution?.length > 0 && (
            <View style={styles.gradeDistribution}>
              <Text style={styles.subsectionTitle}>Grade Distribution</Text>
              <View style={styles.gradeBarContainer}>
                {['A', 'B', 'C', 'D', 'F'].map(grade => {
                  const entry = profile.grade_distribution.find(g => g.grade === grade);
                  const count = parseInt(entry?.count) || 0;
                  const total = profile.total_scans || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <View key={grade} style={styles.gradeBarRow}>
                      <Text style={styles.gradeBarLabel}>{grade}</Text>
                      <View style={styles.gradeBarTrack}>
                        <View
                          style={[
                            styles.gradeBarFill,
                            { width: `${pct}%`, backgroundColor: getGradeColor(grade) },
                          ]}
                        />
                      </View>
                      <Text style={styles.gradeBarCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

        {/* Wardrobe */}
        {wardrobeItems.length > 0 && (
          <Card style={styles.wardrobeCard}>
            <View style={styles.wardrobeSectionHeader}>
              <View style={styles.outfitsTitleRow}>
                <Ionicons name="shirt-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Wardrobe</Text>
              </View>
              <Text style={styles.outfitsCount}>{wardrobeItems.length} items</Text>
            </View>
            <View style={styles.wardrobeGrid}>
              {wardrobeItems.slice(0, 6).map((item) => {
                const imageUri = item.thumbnailUrl || item.imageUrl;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.wardrobeThumb}
                    onPress={() => navigation.navigate('Trade', {
                      otherFirebaseUid: targetUid,
                      otherUserName: displayName,
                    })}
                    activeOpacity={0.75}
                  >
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.wardrobeThumbImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.wardrobeThumbImage, styles.wardrobePlaceholder]}>
                        <Ionicons name="shirt-outline" size={20} color={colors.textTertiary} />
                      </View>
                    )}
                    {item.environmentalGrade && (
                      <View style={[styles.wardrobeGrade, { backgroundColor: getGradeColor(item.environmentalGrade) }]}>
                        <Text style={styles.wardrobeGradeText}>{item.environmentalGrade}</Text>
                      </View>
                    )}
                    <View style={styles.tradeOverlay}>
                      <Ionicons name="swap-horizontal" size={12} color="#fff" />
                    </View>
                    <Text style={styles.wardrobeItemName} numberOfLines={1}>{item.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {wardrobeItems.length > 6 && (
              <Text style={styles.wardrobeMore}>+{wardrobeItems.length - 6} more items</Text>
            )}
          </Card>
        )}

        {/* Outfits */}
        {outfits.length > 0 && (
          <Card style={styles.outfitsCard}>
            <View style={styles.outfitsSectionHeader}>
              <View style={styles.outfitsTitleRow}>
                <Ionicons name="layers-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Outfits</Text>
              </View>
              <Text style={styles.outfitsCount}>{outfits.length}</Text>
            </View>
            {outfits.map(outfit => (
              <View key={outfit.id} style={styles.outfitRow}>
                <View style={styles.outfitInfo}>
                  <Text style={styles.outfitName}>{outfit.name}</Text>
                  {outfit.dayOfWeek && (
                    <View style={styles.outfitDayBadge}>
                      <Text style={styles.outfitDayText}>{outfit.dayOfWeek}</Text>
                    </View>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.outfitThumbnails}>
                  {outfit.items.map((item, idx) => (
                    <View key={idx} style={styles.outfitThumb}>
                      {item.thumbnailUrl || item.imageUrl ? (
                        <Image source={{ uri: item.thumbnailUrl || item.imageUrl }} style={styles.outfitThumbImage} />
                      ) : (
                        <Ionicons name="shirt-outline" size={16} color={colors.textTertiary} />
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            ))}
          </Card>
        )}

        {/* Public Posts */}
        <Text style={styles.sectionTitle}>Public Scans</Text>
        {posts.length > 0 ? (
          posts.map(post => (
            <FeedPostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              onComment={handleComment}
              onProfilePress={() => {}}
              currentUserUid={user?.uid}
            />
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {isOwnProfile
                ? 'Share a scan to see it here!'
                : 'No public scans yet'}
            </Text>
          </Card>
        )}
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
    paddingBottom: spacing.xl,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarLargeText: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '800',
  },
  avatarLargeImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.full,
  },
  displayName: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '800',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  followButton: {
    flex: 1,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 100,
  },
  messageBtnLoading: {
    opacity: 0.6,
  },
  messageBtnText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
  },
  statsCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  sustainabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gradeDisplay: {
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  gradeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sustainabilityDetails: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  subsectionTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  gradeDistribution: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  gradeBarContainer: {
    gap: spacing.xs,
  },
  gradeBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gradeBarLabel: {
    width: 20,
    ...typography.bodySmall,
    fontWeight: '700',
    textAlign: 'center',
  },
  gradeBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 6,
    overflow: 'hidden',
  },
  gradeBarFill: {
    height: '100%',
    borderRadius: 6,
    minWidth: 4,
  },
  gradeBarCount: {
    width: 24,
    ...typography.caption,
    textAlign: 'right',
  },
  wardrobeCard: {
    marginBottom: spacing.md,
  },
  wardrobeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  wardrobeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wardrobeThumb: {
    width: (Dimensions.get('window').width - spacing.lg * 2 - spacing.md * 2 - 16) / 3,
    alignItems: 'center',
  },
  wardrobeThumbImage: {
    width: '100%',
    aspectRatio: 0.85,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  wardrobePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wardrobeGrade: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  wardrobeGradeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  wardrobeItemName: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  tradeOverlay: {
    position: 'absolute',
    bottom: 24,
    right: 4,
    backgroundColor: colors.primary,
    borderRadius: 8,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardrobeMore: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  outfitsCard: {
    marginBottom: spacing.md,
  },
  outfitsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  outfitsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  outfitsCount: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  outfitRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  outfitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  outfitName: {
    ...typography.body,
    fontWeight: '600',
  },
  outfitDayBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
  },
  outfitDayText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  outfitThumbnails: {
    flexDirection: 'row',
  },
  outfitThumb: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSecondary,
    marginRight: spacing.xs,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outfitThumbImage: {
    width: '100%',
    height: '100%',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

export default SocialProfileScreen;
