// author: caitriona mccann
// date: 18/03/2026
// last updated: 14/04/2026
// chat screen - real-time(ish) messaging between two users
//
// how it works:
//   messages are loaded via polling (every 5 seconds via setInterval).
//   there is no websocket/SSE - the interval is started on screen focus and
//   cleared on blur via useFocusEffect cleanup.
//
// message types (stored in messages.message_type):
//   'text'         - plain text bubble
//   'trade_request'- a trade offer card (links to TradeScreen via handleTradePress)
//   'trade_update' - auto-generated status update (accepted / declined / completed)
//
// trade button (top-right swap icon):
//   opens TradeScreen in "create" mode, pre-filling otherFirebaseUid and conversationId.
//   once a trade is created, a 'trade_request' message appears in the chat.
//
// layout:
//   header with back arrow, avatar, and other user's name + trade button
//   FlatList of message bubbles (own messages right-aligned, other user left-aligned)
//   text input + send button at the bottom (KeyboardAvoidingView handles keyboard overlap)
//
// navigation params required:
//   conversationId    - DB id of the conversation
//   otherUserName     - display name shown in header
//   otherFirebaseUid  - uid of the other participant (for creating trades)
//   otherAvatarUrl    - avatar shown in header (can be null)

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/theme';
import {
  fetchMessages,
  sendMessage,
  fetchTradeRequest,
} from '../../services/api';

const ChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { conversationId, otherUserName, otherFirebaseUid, otherAvatarUrl } = route.params;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const pollRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
      // poll for new messages every 5 seconds
      pollRef.current = setInterval(loadMessages, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [conversationId])
  );

  const loadMessages = async () => {
    const result = await fetchMessages(conversationId);
    if (result.success) {
      setMessages(result.messages || []);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);
    const text = inputText.trim();
    setInputText('');

    const result = await sendMessage(conversationId, text);
    if (result.success) {
      await loadMessages();
    }
    setSending(false);
  };

  const handleTradePress = (tradeRequestId) => {
    navigation.navigate('Trade', { tradeRequestId, conversationId, otherFirebaseUid, otherUserName });
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return date.toLocaleDateString();
  };

  // group messages by date
  const getDateForMessage = (msg) => new Date(msg.created_at).toDateString();

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_firebase_uid === user?.uid;
    const isTradeMessage = item.message_type === 'trade_request' || item.message_type === 'trade_update';

    // show date header if first message or different date from previous
    let showDateHeader = false;
    if (index === 0) {
      showDateHeader = true;
    } else {
      const prevDate = getDateForMessage(messages[index - 1]);
      const currDate = getDateForMessage(item);
      if (prevDate !== currDate) showDateHeader = true;
    }

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        {isTradeMessage ? (
          <TouchableOpacity
            style={styles.tradeMessageCard}
            onPress={() => item.trade_request_id && handleTradePress(item.trade_request_id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View trade details"
          >
            <View style={styles.tradeMessageIcon}>
              <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
            </View>
            <View style={styles.tradeMessageContent}>
              <Text style={styles.tradeMessageText}>
                {isMe ? 'You' : (item.sender_name || 'User')} {item.content}
              </Text>
              <Text style={styles.tradeMessageAction}>Tap to view trade details</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.messageBubbleRow, isMe && styles.messageBubbleRowMe]}>
            <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
              <Text style={[styles.messageText, isMe && styles.myMessageText]}>
                {item.content}
              </Text>
              <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerProfile}
            onPress={() => navigation.navigate('SocialProfile', { firebaseUid: otherFirebaseUid })}
            accessibilityRole="button"
            accessibilityLabel={`View ${otherUserName || 'user'} profile`}
          >
            {otherAvatarUrl ? (
              <Image source={{ uri: otherAvatarUrl }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Ionicons name="person" size={16} color={colors.textTertiary} />
              </View>
            )}
            <Text style={styles.headerName} numberOfLines={1}>{otherUserName || 'User'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tradeBtn}
            onPress={() => navigation.navigate('Trade', { conversationId, otherFirebaseUid, otherUserName })}
            accessibilityRole="button"
            accessibilityLabel="Create trade request"
          >
            <Ionicons name="swap-horizontal" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            keyboardDismissMode="interactive"
            accessibilityLabel="Conversation messages"
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            accessibilityLabel="Message input"
            accessibilityHint="Type a message to send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons name="send" size={20} color={inputText.trim() && !sending ? '#fff' : colors.textTertiary} />
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
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: spacing.sm,
  },
  headerAvatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerName: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  tradeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  dateHeaderText: {
    ...typography.caption,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  messageBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.xs,
  },
  messageBubbleRowMe: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    ...shadows.soft,
  },
  messageText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  tradeMessageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  tradeMessageIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  tradeMessageContent: {
    flex: 1,
  },
  tradeMessageText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  tradeMessageAction: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    marginRight: spacing.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceSecondary,
  },
});

export default ChatScreen;
