// author: caitriona mccann
// date: 09/02/2026
// comments screen - displays and allows adding comments on a feed post
// supports threaded replies

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { fetchComments, addComment } from '../../services/api';

const CommentsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { postId } = route.params || {};
  const { user } = useAuth();
  const inputRef = useRef(null);

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    setLoading(true);
    const result = await fetchComments(postId);
    if (result.success) {
      setComments(result.comments || []);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    const result = await addComment(postId, newComment.trim(), replyTo?.id || null);

    if (result.success) {
      setNewComment('');
      setReplyTo(null);
      await loadComments(); // reload to get proper ordering
    }
    setSubmitting(false);
  };

  const handleReply = (comment) => {
    setReplyTo(comment);
    inputRef.current?.focus();
  };

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const renderComment = ({ item, isReply = false }) => {
    const authorName = item.author_name || item.author_email?.split('@')[0] || 'User';
    return (
      <View style={[styles.commentItem, isReply && styles.replyItem]}>
        <View style={[styles.avatar, isReply && styles.replyAvatar]}>
          <Text style={styles.avatarText}>
            {authorName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.commentText}>{item.content}</Text>
          {!isReply && (
            <TouchableOpacity onPress={() => handleReply(item)}>
              <Text style={styles.replyButton}>Reply</Text>
            </TouchableOpacity>
          )}

          {/* Nested Replies */}
          {item.replies?.length > 0 && (
            <View style={styles.replies}>
              {item.replies.map(reply => (
                <View key={reply.id}>
                  {renderComment({ item: reply, isReply: true })}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Comments</Text>
      </View>

      {/* Comments List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => renderComment({ item })}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {replyTo && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText}>
              Replying to {replyTo.author_name || 'User'}
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Text style={styles.cancelReply}>X</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textTertiary}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newComment.trim() || submitting) && styles.sendButtonDisabled]}
            onPress={handleSubmit}
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
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
    paddingBottom: spacing.md,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  replyItem: {
    paddingLeft: spacing.md,
    borderBottomWidth: 0,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  authorName: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  timestamp: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  commentText: {
    ...typography.body,
    lineHeight: 20,
  },
  replyButton: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  replies: {
    marginTop: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyBannerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  cancelReply: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendText: {
    ...typography.bodySmall,
    color: colors.background,
    fontWeight: '700',
  },
});

export default CommentsScreen;
