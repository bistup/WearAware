// author: caitriona mccann
// date: 18/03/2026
// messages list screen - shows all conversations with last message preview

import React, { useState, useCallback } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/theme';
import { fetchConversations } from '../../services/api';

const MessagesScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  const loadConversations = async () => {
    setLoading(true);
    const result = await fetchConversations();
    if (result.success) {
      setConversations(result.conversations || []);
    }
    setLoading(false);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const getPreviewText = (item) => {
    if (item.last_message_type === 'trade_request') return '🔄 Trade request';
    if (item.last_message_type === 'trade_update') return '🔄 Trade update';
    return item.last_message || 'No messages yet';
  };

  const renderConversation = ({ item }) => {
    const unread = parseInt(item.unread_count) > 0;
    return (
      <TouchableOpacity
        style={[styles.conversationCard, unread && styles.unreadCard]}
        onPress={() => navigation.navigate('Chat', {
          conversationId: item.id,
          otherUserName: item.other_display_name,
          otherFirebaseUid: item.other_firebase_uid,
          otherAvatarUrl: item.other_avatar_url,
        })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Conversation with ${item.other_display_name || 'User'}${unread ? ', unread messages' : ''}`}
      >
        <View style={styles.avatarContainer}>
          {item.other_avatar_url ? (
            <Image source={{ uri: item.other_avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={22} color={colors.textTertiary} />
            </View>
          )}
          {unread && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.topRow}>
            <Text style={[styles.userName, unread && styles.unreadText]} numberOfLines={1}>
              {item.other_display_name || 'User'}
            </Text>
            <Text style={styles.timestamp}>{formatTime(item.last_message_at)}</Text>
          </View>
          <Text style={[styles.preview, unread && styles.unreadPreview]} numberOfLines={1}>
            {getPreviewText(item)}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>
            Start a conversation from someone's profile or send a trade request!
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderConversation}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  unreadCard: {
    backgroundColor: colors.primaryMuted,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  conversationContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  userName: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadText: {
    fontWeight: '700',
  },
  timestamp: {
    ...typography.caption,
  },
  preview: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  unreadPreview: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

export default MessagesScreen;
