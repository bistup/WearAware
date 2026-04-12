// author: caitriona mccann
// date: 09/02/2026
// alternatives screen - shows sustainable product recommendations after a scan
// users can compare, save to wishlist, and visit external shops

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Card from '../../components/Card';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, getGradeColor } from '../../theme/theme';
import { searchWebAlternatives, searchSecondHand } from '../../services/api';

const AlternativesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { scanData, scanId } = route.params || {};

  const [webResults, setWebResults] = useState([]);
  const [secondHandResults, setSecondHandResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('web'); // 'web' or 'secondhand'
  const [selectedGender, setSelectedGender] = useState(scanData?.gender || null);

  const scannedItem = scanData ? {
    waterUsage: scanData.water_usage_liters || scanData.waterUsage || 0,
    carbonFootprint: scanData.carbon_footprint_kg || scanData.carbonFootprint || 0,
    score: scanData.score || 0,
    grade: scanData.grade || 'C',
  } : null;

  useEffect(() => {
    loadRecommendations();
  }, [selectedGender]);

  const loadRecommendations = async () => {
    setLoading(true);
    const itemType = scanData?.item_type || scanData?.itemType || 'Garment';

    // get primary fiber from scan data for web search
    const fibers = scanData?.fibers || [];
    const primaryFiber = fibers.length > 0
      ? (typeof fibers[0] === 'string' ? fibers[0] : fibers[0]?.name)
      : null;

    const imageUrl = scanData?.image_url || scanData?.imageUrl || null;

    const [webResult, ebayResult] = await Promise.allSettled([
      searchWebAlternatives(itemType, primaryFiber, imageUrl, selectedGender),
      searchSecondHand(itemType, primaryFiber, imageUrl, selectedGender),
    ]);

    if (webResult.status === 'fulfilled' && webResult.value.success) {
      setWebResults(webResult.value.results || []);
    }

    if (ebayResult.status === 'fulfilled' && ebayResult.value.success) {
      setSecondHandResults(ebayResult.value.results || []);
    }

    setLoading(false);
  };

  const getDisplayList = () => {
    if (activeSection === 'secondhand') return secondHandResults;
    return webResults;
  };

  const renderHeader = () => {
    const displayList = getDisplayList();

    const hasWeb = webResults.length > 0;
    const hasSecondHand = secondHandResults.length > 0;

    return (
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

        <Text style={styles.title}>Better Alternatives</Text>
        <Text style={styles.subtitle}>
          {`Sustainable options for your ${scanData?.item_type || scanData?.itemType || 'item'}`}
        </Text>

        {/* Current Scan Summary */}
        {scannedItem && (
          <Card style={styles.currentScanCard}>
            <Text style={styles.currentLabel}>Your Scanned Item</Text>
            <View style={styles.currentRow}>
              <View style={[styles.currentGrade, { backgroundColor: getGradeColor(scannedItem.grade) }]}>
                <Text style={styles.currentGradeText}>{scannedItem.grade}</Text>
              </View>
              <View style={styles.currentInfo}>
                <Text style={styles.currentBrand}>{scanData?.brand || 'Unknown'}</Text>
                <Text style={styles.currentScore}>Score: {scannedItem.score}/100</Text>
              </View>
              <View style={styles.currentMetrics}>
                <Text style={styles.currentMetric}>{scannedItem.waterUsage?.toFixed(0)}L</Text>
                <Text style={styles.currentMetric}>{scannedItem.carbonFootprint?.toFixed(2)}kg</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Gender Filter */}
        <View style={styles.genderFilter}>
          {[
            { key: null, label: 'All' },
            { key: "men's", label: "Men's" },
            { key: "women's", label: "Women's" },
          ].map(g => (
            <TouchableOpacity
              key={g.key || 'all'}
              style={[styles.genderBtn, selectedGender === g.key && styles.genderBtnActive]}
              onPress={() => setSelectedGender(g.key)}
            >
              <Text style={[styles.genderBtnText, selectedGender === g.key && styles.genderBtnTextActive]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section Toggle Tabs */}
        {hasWeb && hasSecondHand && (
          <View style={styles.sectionToggle}>
            <TouchableOpacity
              style={[styles.sectionTab, activeSection === 'web' && styles.sectionTabActive]}
              onPress={() => setActiveSection('web')}
            >
              <Text style={[styles.sectionTabText, activeSection === 'web' && styles.sectionTabTextActive]}>
                Web Results
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sectionTab, activeSection === 'secondhand' && styles.sectionTabActive]}
              onPress={() => setActiveSection('secondhand')}
            >
              <Text style={[styles.sectionTabText, activeSection === 'secondhand' && styles.sectionTabTextActive]}>
                Second Hand
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.resultsLabel}>
          {displayList.length} {activeSection === 'secondhand' ? 'second-hand item' : 'product'}{displayList.length !== 1 ? 's' : ''} found
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Great Choice!</Text>
        <Text style={styles.emptyText}>
          Your item already has a high sustainability score. No better alternatives found in our database.
        </Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() => navigation.navigate('Wishlist')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.browseText}>Browse Wishlist</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.background} />
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding sustainable alternatives...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderWebResultCard = ({ item }) => (
    <View style={styles.webCard}>
      {item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.webProductImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.webCardContent}>
        {item.brand && (
          <Text style={styles.webBrand}>{item.brand}</Text>
        )}
        <Text style={styles.webTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.webSnippet} numberOfLines={2}>{item.snippet}</Text>
        <View style={styles.webFooter}>
          {item.price && (
            <Text style={styles.webPrice}>{item.price}</Text>
          )}
          <Text style={styles.webSite}>{item.siteName}</Text>
        </View>
        <TouchableOpacity
          style={styles.webVisitButton}
          onPress={() => Linking.openURL(item.link)}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel={`View product on ${item.siteName || 'store'}`}
        >
          <Text style={styles.webVisitText}>View Product</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSecondHandCard = ({ item }) => (
    <View style={styles.webCard}>
      {item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.webProductImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.webCardContent}>
        <View style={styles.secondHandBadge}>
          <Text style={styles.secondHandBadgeText}>{item.condition || 'Pre-Owned'}</Text>
        </View>
        <Text style={styles.webTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.webFooter}>
          {item.price && (
            <Text style={styles.webPrice}>{item.price}</Text>
          )}
          {item.seller && (
            <Text style={styles.webSite}>{item.seller}</Text>
          )}
        </View>
        {item.location && (
          <Text style={styles.secondHandLocation}>{item.location}</Text>
        )}
        {item.shippingCost && (
          <Text style={styles.secondHandShipping}>Shipping: {item.shippingCost}</Text>
        )}
        <TouchableOpacity
          style={styles.webVisitButton}
          onPress={() => Linking.openURL(item.link)}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel={`View ${item.title || 'item'} on eBay`}
        >
          <Text style={styles.webVisitText}>View on eBay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItem = ({ item }) => {
    if (activeSection === 'secondhand') {
      return renderSecondHandCard({ item });
    }
    return renderWebResultCard({ item });
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={getDisplayList()}
        keyExtractor={(item, index) => item.id?.toString() || item.itemId || item.link || index.toString()}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
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
  currentScanCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  currentLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentGrade: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  currentGradeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  currentInfo: {
    flex: 1,
  },
  currentBrand: {
    ...typography.body,
    fontWeight: '600',
  },
  currentScore: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  currentMetrics: {
    alignItems: 'flex-end',
  },
  currentMetric: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  resultsLabel: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.md,
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
  browseButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  browseText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
  genderFilter: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  genderBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genderBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genderBtnText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  genderBtnTextActive: {
    color: colors.background,
    fontWeight: '700',
  },
  sectionToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: 4,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  sectionTabActive: {
    backgroundColor: colors.primary,
  },
  sectionTabText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sectionTabTextActive: {
    color: colors.background,
    fontWeight: '600',
  },
  matchBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  matchBadgeText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  // web result card styles
  webCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  webProductImage: {
    width: '100%',
    height: 180,
  },
  webCardContent: {
    padding: spacing.md,
  },
  webBrand: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  webTitle: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  webSnippet: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  webFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  webPrice: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '800',
  },
  webSite: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  webVisitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  webVisitText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '700',
  },
  // second-hand card styles
  secondHandBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  secondHandBadgeText: {
    ...typography.caption,
    color: '#2E7D32',
    fontWeight: '700',
  },
  secondHandLocation: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  secondHandShipping: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
});

export default AlternativesScreen;
