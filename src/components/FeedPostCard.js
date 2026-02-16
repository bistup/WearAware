// author: caitriona mccann
// date: 09/02/2026
// feed post card - displays a shared scan in the social feed
// shows scan grade, brand, author info, likes, comments

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Card from './Card';
import GradeIndicator from './GradeIndicator';
import { colors, typography, spacing, borderRadius } from '../theme/theme';

const FeedPostCard = ({ post, onLike, onComment, onProfilePress, currentUserUid }) => {
  const [liked, setLiked] = useState(post.userLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);

  const handleLike = async () => {
    // optimistic update
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));

    const result = await onLike(post.id);
    if (!result?.success) {
      // revert on failure
      setLiked(!newLiked);
      setLikeCount(prev => newLiked ? Math.max(0, prev - 1) : prev + 1);
    }
  };

  const timeAgo = getTimeAgo(post.createdAt);
  const authorName = post.author?.displayName || post.author?.email?.split('@')[0] || 'User';

  return (
    <Card style={styles.card}>
      {/* Author Row */}
      <TouchableOpacity
        style={styles.authorRow}
        onPress={() => onProfilePress?.(post.author?.firebaseUid)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {authorName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.timestamp}>{timeAgo}</Text>
        </View>
      </TouchableOpacity>

      {/* Scan Data */}
      {post.scan && (
        <View style={styles.scanPreview}>
          <View style={styles.scanHeader}>
            <GradeIndicator grade={post.scan.grade || 'C'} size="small" />
            <View style={styles.scanDetails}>
              <Text style={styles.scanBrand}>{post.scan.brand || 'Unknown Brand'}</Text>
              <Text style={styles.scanType}>{post.scan.itemType || 'Garment'}</Text>
            </View>
            <Text style={styles.scanScore}>{post.scan.score}/100</Text>
          </View>

          {/* Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricIcon}>Water:</Text>
              <Text style={styles.metricValue}>
                {post.scan.waterUsage?.toFixed(1) || '0'}L
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricIcon}>CO2:</Text>
              <Text style={styles.metricValue}>
                {post.scan.carbonFootprint?.toFixed(2) || '0'}kg CO₂
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Caption */}
      {post.caption && (
        <Text style={styles.caption}>{post.caption}</Text>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}
          accessibilityRole="button"
          accessibilityLabel={liked ? `Unlike, ${likeCount} likes` : `Like, ${likeCount} likes`}
        >
          <Text style={styles.actionIcon}>{liked ? 'Liked' : 'Like'}</Text>
          <Text style={[styles.actionText, liked && styles.likedText]}>
            {likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onComment?.(post.id)}
          accessibilityRole="button"
          accessibilityLabel={`Comment, ${post.commentCount || 0} comments`}
        >
          <Text style={styles.actionIcon}>Comment</Text>
          <Text style={styles.actionText}>{post.commentCount || 0}</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    ...typography.body,
    fontWeight: '600',
  },
  timestamp: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  scanPreview: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  scanDetails: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  scanBrand: {
    ...typography.body,
    fontWeight: '700',
  },
  scanType: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scanScore: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metricIcon: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  metricValue: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  caption: {
    ...typography.body,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  actionIcon: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  likedText: {
    color: colors.primary,
    fontWeight: '700',
  },
});

export default FeedPostCard;
