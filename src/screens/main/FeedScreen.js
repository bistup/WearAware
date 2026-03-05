// author: caitriona mccann
// date: 09/02/2026
// social feed screen - shows scans shared by followed users
// supports pull-to-refresh, infinite scroll, and discover mode

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import FeedPostCard from '../../components/FeedPostCard';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { fetchFeed, fetchDiscoverFeed, fetchMyPosts, toggleLike, searchUsers } from '../../services/api';

const FeedScreen = () => {
  const navigation = useNavigation();
  const { user, isGuest } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState('following'); // 'following', 'discover', or 'mine'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadFeed(1, true);
    }, [activeTab])
  );

  const loadFeed = async (pageNum = 1, reset = false) => {
    if (pageNum === 1) setLoading(true);

    const fetcher = activeTab === 'mine' ? fetchMyPosts : activeTab === 'following' ? fetchFeed : fetchDiscoverFeed;
    const result = await fetcher(pageNum);

    if (result.success) {
      if (reset || pageNum === 1) {
        setPosts(result.posts || []);
      } else {
        setPosts(prev => [...prev, ...(result.posts || [])]);
      }
      setHasMore(result.hasMore !== false);
      setPage(pageNum);
    } else {
      setHasMore(false);
    }
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed(1, true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      loadFeed(page + 1);
    }
  };

  const handleLike = async (postId) => {
    const result = await toggleLike(postId);
    return result;
  };

  const handleComment = (postId) => {
    navigation.navigate('Comments', { postId });
  };

  const handleProfilePress = (firebaseUid) => {
    if (firebaseUid) {
      navigation.navigate('SocialProfile', { firebaseUid });
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      setSearching(true);
      const result = await searchUsers(query);
      if (result.success) {
        setSearchResults(result.users || []);
      }
      setSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>
        {activeTab === 'following'
          ? 'Your feed is empty'
          : activeTab === 'mine'
          ? "You haven't shared any scans yet"
          : 'No public scans yet'}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'following'
          ? 'Follow other users to see their sustainable scans here'
          : 'Be the first to share a scan with the community!'}
      </Text>
      {activeTab === 'following' && (
        <TouchableOpacity
          style={styles.discoverButton}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={styles.discoverButtonText}>Discover Users</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      style={styles.searchResult}
      onPress={() => {
        setSearchQuery('');
        setSearchResults([]);
        navigation.navigate('SocialProfile', { firebaseUid: item.firebase_uid });
      }}
    >
      <View style={styles.searchAvatar}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.searchAvatarImage} />
        ) : (
          <Text style={styles.searchAvatarText}>
            {(item.display_name || item.email || 'U').charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.searchInfo}>
        <Text style={styles.searchName}>
          {item.display_name || item.email?.split('@')[0]}
        </Text>
        <Text style={styles.searchEmail}>{item.email}</Text>
      </View>
      {item.sustainability_score > 0 && (
        <Text style={styles.searchScore}>Score: {item.sustainability_score}</Text>
      )}
    </TouchableOpacity>
  );

  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.guestContainer}>
          <Text style={styles.guestTitle}>Sign In Required</Text>
          <Text style={styles.guestText}>
            Create an account to access the community feed and follow other users.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} style={{ marginRight: spacing.xs }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
            accessibilityLabel="Search users"
            accessibilityHint="Type at least 2 characters to search"
          />
        </View>
      </View>

      {/* Search Results Overlay */}
      {searchResults.length > 0 && (
        <View style={styles.searchOverlay}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.firebase_uid}
            renderItem={renderSearchResult}
            style={styles.searchList}
          />
        </View>
      )}

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'following' && styles.tabActive]}
          onPress={() => setActiveTab('following')}
        >
          <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
            Following
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'mine' && styles.tabActive]}
          onPress={() => setActiveTab('mine')}
        >
          <Text style={[styles.tabText, activeTab === 'mine' && styles.tabTextActive]}>
            My Posts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feed */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <FeedPostCard
              post={item}
              onLike={handleLike}
              onComment={handleComment}
              onProfilePress={handleProfilePress}
              currentUserUid={user?.uid}
            />
          )}
          contentContainerStyle={styles.feedContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.loadingMore}
              />
            ) : null
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
  },
  headerAction: {
    fontSize: 28,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 44,
  },
  searchOverlay: {
    position: 'absolute',
    top: 140,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    maxHeight: 200,
    zIndex: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchList: {
    padding: spacing.sm,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchAvatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  searchAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.full,
  },
  searchAvatarText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  searchInfo: {
    flex: 1,
  },
  searchName: {
    ...typography.body,
    fontWeight: '600',
  },
  searchEmail: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  searchScore: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontWeight: '700',
  },
  feedContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMore: {
    paddingVertical: spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  discoverButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  discoverButtonText: {
    ...typography.button,
    color: colors.background,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  guestIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  guestTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  guestText: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});

export default FeedScreen;
