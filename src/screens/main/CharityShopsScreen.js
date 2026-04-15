// author: caitriona mccann
// date: 12/03/2026
// charity shops screen - shows nearby charity/thrift shops on a map
// uses expo-location for user position and react-native-maps for display

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/theme';
import { fetchNearbyCharityShops } from '../../services/api';
import { useAlert } from '../../context/AlertContext';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 300;

const CharityShopsScreen = () => {
  const { showAlert } = useAlert();
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [radius, setRadius] = useState(5000); // 5km default

  const radiusOptions = [
    { label: '2 km', value: 2000 },
    { label: '5 km', value: 5000 },
    { label: '10 km', value: 10000 },
    { label: '25 km', value: 25000 },
  ];

  useEffect(() => {
    getLocationAndShops();
  }, []);

  const getLocationAndShops = async () => {
    setLoading(true);
    setLocationError(null);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Location permission is needed to find shops near you.');
      setLoading(false);
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc.coords);
      await loadShops(loc.coords.latitude, loc.coords.longitude, radius);
    } catch (err) {
      setLocationError('Could not get your location. Please check your settings.');
      setLoading(false);
    }
  };

  const loadShops = async (lat, lng, searchRadius) => {
    setLoading(true);
    const result = await fetchNearbyCharityShops(lat, lng, searchRadius);
    if (result.success) {
      setShops(result.shops || []);
    } else {
      showAlert('Error', result.error || 'Failed to find nearby shops');
    }
    setLoading(false);
  };

  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
    if (location) {
      loadShops(location.latitude, location.longitude, newRadius);
    }
  };

  const handleShopPress = (shop) => {
    setSelectedShop(shop);
    mapRef.current?.animateToRegion({
      latitude: shop.lat,
      longitude: shop.lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 500);
  };

  const openDirections = (shop) => {
    const scheme = Platform.OS === 'ios' ? 'maps:' : 'geo:';
    const url = Platform.OS === 'ios'
      ? `maps:?daddr=${shop.lat},${shop.lng}&dirflg=d`
      : `geo:${shop.lat},${shop.lng}?q=${shop.lat},${shop.lng}(${encodeURIComponent(shop.name)})`;
    Linking.openURL(url).catch(() => {
      // fallback to Google Maps web
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`);
    });
  };

  const formatDistance = (meters) => {
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const renderShopItem = ({ item }) => {
    const isSelected = selectedShop?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.shopCard, isSelected && styles.shopCardSelected]}
        onPress={() => handleShopPress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.address}${item.openNow != null ? `, ${item.openNow ? 'Open' : 'Closed'}` : ''}`}
      >
        <View style={styles.shopRow}>
          <View style={styles.shopIconContainer}>
            <Ionicons name="storefront-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.shopInfo}>
            <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.shopAddress} numberOfLines={2}>{item.address}</Text>
            <View style={styles.shopMeta}>
              {item.distance != null && (
                <View style={styles.metaItem}>
                  <Ionicons name="navigate-outline" size={12} color={colors.textTertiary} />
                  <Text style={styles.metaText}>{formatDistance(item.distance)}</Text>
                </View>
              )}
              {item.rating != null && (
                <View style={styles.metaItem}>
                  <Ionicons name="star" size={12} color="#F5A623" />
                  <Text style={styles.metaText}>{item.rating} ({item.totalRatings})</Text>
                </View>
              )}
              {item.openNow != null && (
                <View style={styles.metaItem}>
                  <View style={[styles.openDot, { backgroundColor: item.openNow ? '#34C759' : colors.error }]} />
                  <Text style={[styles.metaText, { color: item.openNow ? '#34C759' : colors.error }]}>
                    {item.openNow ? 'Open' : 'Closed'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => openDirections(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Get directions to ${item.name}`}
          >
            <Ionicons name="navigate" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <View style={styles.backRow}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Charity Shops</Text>
        <Text style={styles.subtitle}>Donate or find second-hand fashion near you</Text>
      </View>

      {locationError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={getLocationAndShops}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Map */}
          <View style={styles.mapContainer}>
            {location ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                initialRegion={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.04,
                  longitudeDelta: 0.04,
                }}
                showsUserLocation
                showsMyLocationButton
              >
                {shops.map((shop) => (
                  <Marker
                    key={shop.id}
                    coordinate={{ latitude: shop.lat, longitude: shop.lng }}
                    title={shop.name}
                    description={shop.address}
                    pinColor={selectedShop?.id === shop.id ? colors.accent : colors.primary}
                    onPress={() => setSelectedShop(shop)}
                  />
                ))}
              </MapView>
            ) : (
              <View style={styles.mapPlaceholder}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Getting your location...</Text>
              </View>
            )}
          </View>

          {/* Radius filter */}
          <View style={styles.filterRow}>
            <Ionicons name="resize-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.filterLabel}>Radius:</Text>
            {radiusOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.radiusChip, radius === opt.value && styles.radiusChipActive]}
                onPress={() => handleRadiusChange(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: radius === opt.value }}
                accessibilityLabel={`${opt.label} radius`}
              >
                <Text style={[styles.radiusChipText, radius === opt.value && styles.radiusChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Shop list */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Finding charity shops...</Text>
            </View>
          ) : (
            <FlatList
              data={shops}
              renderItem={renderShopItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="storefront-outline" size={48} color={colors.textTertiary} />
                  <Text style={styles.emptyText}>No charity shops found nearby</Text>
                  <Text style={styles.emptySubtext}>Try increasing the search radius</Text>
                </View>
              }
              ListHeaderComponent={
                shops.length > 0 ? (
                  <Text style={styles.resultCount}>{shops.length} shops found</Text>
                ) : null
              }
            />
          )}
        </>
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
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
  },
  mapContainer: {
    height: MAP_HEIGHT,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.soft,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  radiusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
  },
  radiusChipActive: {
    backgroundColor: colors.primary,
  },
  radiusChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  radiusChipTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  resultCount: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  shopCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shopCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  shopInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  shopName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  shopAddress: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  shopMeta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  directionsButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  retryText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});

export default CharityShopsScreen;
