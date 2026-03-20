// author: caitriona mccann
// date: 09/02/2026
// wishlist screen - shows saved sustainable product recommendations
// users can remove items or visit external shops

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import { colors, typography, spacing, borderRadius, getGradeColor } from '../../theme/theme';
import { fetchWishlist, removeFromWishlist } from '../../services/api';

const WishlistScreen = () => {
  const navigation = useNavigation();
  const { isGuest } = useAuth();
  const { showAlert } = useAlert();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!isGuest) {
        loadWishlist(1, true);
      } else {
        setLoading(false);
      }
    }, [isGuest])
  );

  const loadWishlist = async (pageNum = 1, refresh = false) => {
    if (refresh) setLoading(true);
    const result = await fetchWishlist(pageNum);
    if (result.success) {
      const newItems = result.wishlist || [];
      setItems(refresh ? newItems : [...items, ...newItems]);
      setHasMore(newItems.length >= 20);
      setPage(pageNum);
    }
    setLoading(false);
  };

  const handleRemove = (wishlistId, productName) => {
    showAlert(
      'Remove from Wishlist',
      `Remove "${productName}" from your wishlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeFromWishlist(wishlistId);
            if (result.success) {
              setItems(prev => prev.filter(i => i.id !== wishlistId));
            }
          },
        },
      ]
    );
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadWishlist(page + 1);
    }
  };

  const renderItem = ({ item }) => (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(item.grade) }]}>
          <Text style={styles.gradeText}>{item.grade}</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemBrand}>{item.brand}</Text>
          <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
        </View>
        {item.price > 0 && (
          <Text style={styles.itemPrice}>${Number(item.price).toFixed(0)}</Text>
        )}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Score</Text>
          <Text style={styles.metricValue}>{item.score}/100</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Water</Text>
          <Text style={styles.metricValue}>{Number(item.water_usage)?.toFixed(0)}L</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>CO₂</Text>
          <Text style={styles.metricValue}>{Number(item.carbon_footprint)?.toFixed(2)}kg</Text>
        </View>
      </View>

      {item.primary_fiber && (
        <Text style={styles.fiberText}>Made with: {item.primary_fiber}</Text>
      )}

      {item.notes ? (
        <Text style={styles.notesText}>{item.notes}</Text>
      ) : null}

      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemove(item.id, item.product_name)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="trash-outline" size={14} color={colors.error} />
            <Text style={styles.removeText}>Remove</Text>
          </View>
        </TouchableOpacity>
        {item.external_url && (
          <TouchableOpacity
            style={styles.visitButton}
            onPress={() => {
              const { Linking } = require('react-native');
              Linking.openURL(item.external_url);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.visitText}>Visit Store</Text>
              <Ionicons name="open-outline" size={14} color={colors.background} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );

  const renderEmpty = () => {
    if (loading) return null;
    if (isGuest) {
      return (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Sign In Required</Text>
          <Text style={styles.emptyText}>
            Create an account to save sustainable alternatives to your wishlist.
          </Text>
        </Card>
      );
    }
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No Saved Items Yet</Text>
        <Text style={styles.emptyText}>
          Scan clothing items and save better alternatives to build your sustainable wishlist.
        </Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate('Camera')}
        >
          <Text style={styles.scanButtonText}>Start Scanning</Text>
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={renderItem}
        ListHeaderComponent={
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
            <Text style={styles.title}>My Wishlist</Text>
            <Text style={styles.subtitle}>
              {items.length} sustainable alternative{items.length !== 1 ? 's' : ''} saved
            </Text>
          </View>
        }
        ListEmptyComponent={renderEmpty}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
  itemCard: {
    marginBottom: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gradeBadge: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  gradeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemInfo: {
    flex: 1,
  },
  itemBrand: {
    ...typography.body,
    fontWeight: '700',
  },
  itemName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  itemPrice: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  metricValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  fiberText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  notesText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  removeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  removeText: {
    ...typography.bodySmall,
    color: colors.error,
    fontWeight: '600',
  },
  visitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  visitText: {
    ...typography.bodySmall,
    color: colors.background,
    fontWeight: '600',
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
    marginBottom: spacing.lg,
  },
  scanButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  scanButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
});

export default WishlistScreen;
