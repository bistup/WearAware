// author: caitriona mccann
// date: 19/03/2026
// marketplace screen - browse wardrobe items listed as free or for trade

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows, getGradeColor } from '../../theme/theme';
import { fetchMarketplace, startConversation, listWardrobeItem } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'free', label: 'Free' },
  { key: 'trade', label: 'Trade' },
];

const MarketplaceScreen = () => {
  const navigation = useNavigation();
  const { user, isGuest } = useAuth();
  const { showAlert } = useAlert();
  const [items, setItems] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [messagingId, setMessagingId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [filter])
  );

  const loadItems = async () => {
    setLoading(true);
    const result = await fetchMarketplace(filter);
    if (result.success) {
      setItems(result.items || []);
      setMyListings(result.myListings || []);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadItems();
  };

  const handleFilterChange = (key) => {
    setFilter(key);
    setLoading(true);
  };

  const handleContactOwner = async (item) => {
    if (isGuest) {
      showAlert('Sign In Required', 'Create an account to message other users.');
      return;
    }
    if (item.ownerFirebaseUid === user?.uid) {
      showAlert('This is your item', 'You listed this item.');
      return;
    }
    setMessagingId(item.id);
    const result = await startConversation(item.ownerFirebaseUid);
    setMessagingId(null);
    if (result.success) {
      navigation.navigate('Chat', {
        conversationId: result.conversationId,
        otherUserName: item.ownerName,
        otherFirebaseUid: item.ownerFirebaseUid,
        otherAvatarUrl: item.ownerAvatarUrl,
      });
    } else {
      showAlert('Error', 'Could not open chat. Please try again.');
    }
  };

  const renderItem = ({ item }) => {
    const isContactLoading = messagingId === item.id;
    const badge = item.availableFor === 'both'
      ? ['free', 'trade']
      : [item.availableFor];

    return (
      <View style={styles.card}>
        {/* Item image */}
        <View style={styles.cardImageWrap}>
          {item.imageUrl || item.thumbnailUrl ? (
            <Image
              source={{ uri: item.thumbnailUrl || item.imageUrl }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Ionicons name="shirt-outline" size={32} color={colors.textTertiary} />
            </View>
          )}
          {/* Grade badge */}
          {item.environmentalGrade && (
            <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(item.environmentalGrade) }]}>
              <Text style={styles.gradeBadgeText}>{item.environmentalGrade}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name || item.itemType || 'Clothing Item'}
            </Text>
            <View style={styles.badgeRow}>
              {badge.map(b => (
                <View
                  key={b}
                  style={[styles.typeBadge, b === 'free' ? styles.freeBadge : styles.tradeBadge]}
                >
                  <Text style={[styles.typeBadgeText, b === 'free' ? styles.freeBadgeText : styles.tradeBadgeText]}>
                    {b === 'free' ? 'Free' : 'Trade'}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {item.brand && (
            <Text style={styles.cardBrand} numberOfLines={1}>{item.brand}</Text>
          )}

          {item.size || item.color ? (
            <Text style={styles.cardMeta} numberOfLines={1}>
              {[item.size, item.color].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          {/* Owner */}
          <View style={styles.ownerRow}>
            <View style={styles.ownerAvatar}>
              {item.ownerAvatarUrl ? (
                <Image source={{ uri: item.ownerAvatarUrl }} style={styles.ownerAvatarImg} />
              ) : (
                <Text style={styles.ownerAvatarInitial}>
                  {(item.ownerName || 'U').charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={styles.ownerName} numberOfLines={1}>{item.ownerName}</Text>
          </View>

          {/* Action */}
          <TouchableOpacity
            style={[styles.contactBtn, isContactLoading && styles.contactBtnLoading]}
            onPress={() => handleContactOwner(item)}
            disabled={isContactLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Message ${item.ownerName || 'owner'} about ${item.name || 'this item'}`}
          >
            {isContactLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="chatbubble-outline" size={15} color="#fff" />
                <Text style={styles.contactBtnText}>Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleUnlist = async (item) => {
    showAlert('Remove Listing', `Remove "${item.name || 'this item'}" from the marketplace?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const result = await listWardrobeItem(item.id, null);
          if (result.success) {
            setMyListings(prev => prev.filter(i => i.id !== item.id));
          }
        },
      },
    ]);
  };

  const renderMyListings = () => {
    if (myListings.length === 0) return null;
    return (
      <View style={styles.myListingsSection}>
        <Text style={styles.myListingsTitle}>Your Listings</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.myListingsScroll}>
          {myListings.map(item => {
            const badge = item.availableFor === 'both' ? ['free', 'trade'] : [item.availableFor];
            return (
              <TouchableOpacity key={item.id} style={styles.myListingCard} onPress={() => handleUnlist(item)} activeOpacity={0.8}>
                <View style={styles.myListingImageWrap}>
                  {item.imageUrl || item.thumbnailUrl ? (
                    <Image source={{ uri: item.thumbnailUrl || item.imageUrl }} style={styles.myListingImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.myListingImagePlaceholder}>
                      <Ionicons name="shirt-outline" size={22} color={colors.textTertiary} />
                    </View>
                  )}
                </View>
                <Text style={styles.myListingName} numberOfLines={1}>{item.name || item.itemType || 'Item'}</Text>
                <View style={styles.badgeRow}>
                  {badge.map(b => (
                    <View key={b} style={[styles.typeBadge, b === 'free' ? styles.freeBadge : styles.tradeBadge]}>
                      <Text style={[styles.typeBadgeText, b === 'free' ? styles.freeBadgeText : styles.tradeBadgeText]}>
                        {b === 'free' ? 'Free' : 'Trade'}
                      </Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="storefront-outline" size={52} color={colors.textTertiary} style={{ marginBottom: spacing.md }} />
      <Text style={styles.emptyTitle}>
        {filter === 'free' ? 'No free items listed' : filter === 'trade' ? 'No trade items listed' : 'Nothing listed yet'}
      </Text>
      <Text style={styles.emptyText}>
        Items listed as free or for trade from your wardrobe will appear here for others to find.
      </Text>
    </View>
  );

  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Marketplace</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="storefront-outline" size={52} color={colors.textTertiary} style={{ marginBottom: spacing.md }} />
          <Text style={styles.emptyTitle}>Sign In Required</Text>
          <Text style={styles.emptyText}>Create an account to browse and list items on the marketplace.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Marketplace</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabContainer}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.tab, filter === f.key && styles.tabActive]}
            onPress={() => handleFilterChange(f.key)}
            accessibilityRole="tab"
            accessibilityLabel={`${f.label} filter`}
            accessibilityState={{ selected: filter === f.key }}
          >
            <Text style={[styles.tabText, filter === f.key && styles.tabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderMyListings}
          ListEmptyComponent={myListings.length === 0 ? renderEmpty : null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  card: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.soft,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  cardInfo: {
    padding: spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardName: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 3,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  freeBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  tradeBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  freeBadgeText: {
    color: '#10B981',
  },
  tradeBadgeText: {
    color: '#3B82F6',
  },
  cardBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  ownerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerAvatarImg: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  ownerAvatarInitial: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },
  ownerName: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    gap: 4,
  },
  contactBtnLoading: {
    opacity: 0.7,
  },
  contactBtnText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
  myListingsSection: {
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  myListingsTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  myListingsScroll: {
    gap: spacing.sm,
  },
  myListingCard: {
    width: 110,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.soft,
  },
  myListingImageWrap: {
    width: '100%',
    height: 90,
    backgroundColor: colors.surfaceSecondary,
  },
  myListingImage: {
    width: '100%',
    height: '100%',
  },
  myListingImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myListingName: {
    ...typography.caption,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
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
  },
});

export default MarketplaceScreen;
