// author: caitriona mccann
// date: 18/03/2026
// trade screen - create/view trade requests, select items, view charity shop dropbox details

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows, getGradeColor } from '../../theme/theme';
import * as Location from 'expo-location';
import {
  fetchWardrobe,
  fetchTradeRequest,
  createTradeRequest,
  respondToTrade,
  completeTrade,
  updateTradeShop,
  fetchNearbyShopsForTrade,
} from '../../services/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

const STATUS_CONFIG = {
  pending:   { icon: 'time-outline',         color: '#F59E0B', bg: '#FFFBEB', label: 'Pending Response' },
  accepted:  { icon: 'checkmark-circle',      color: '#10B981', bg: '#ECFDF5', label: 'Accepted — Dropbox Ready' },
  completed: { icon: 'trophy',               color: colors.primary, bg: colors.primaryLight, label: 'Trade Completed!' },
  declined:  { icon: 'close-circle-outline', color: '#EF4444', bg: '#FEF2F2', label: 'Declined' },
};

const TradeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { tradeRequestId, conversationId, otherFirebaseUid, otherUserName } = route.params || {};

  const [mode, setMode] = useState(tradeRequestId ? 'view' : 'create');
  const [loading, setLoading] = useState(true);
  const [trade, setTrade] = useState(null);

  // create trade state
  const [myItems, setMyItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [tradeType, setTradeType] = useState('free');
  const [submitting, setSubmitting] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // shop picker
  const [shopModalVisible, setShopModalVisible] = useState(false);
  const [nearbyShops, setNearbyShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);

  useEffect(() => {
    if (mode === 'view' && tradeRequestId) {
      loadTradeRequest();
    } else {
      loadMyWardrobe();
    }
    getUserLocation();
  }, []);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    } catch (e) {}
  };

  const loadTradeRequest = async () => {
    setLoading(true);
    const result = await fetchTradeRequest(tradeRequestId);
    if (result.success) setTrade(result.tradeRequest);
    setLoading(false);
  };

  const loadMyWardrobe = async () => {
    setLoading(true);
    const result = await fetchWardrobe();
    if (result.success) setMyItems(result.items || []);
    setLoading(false);
  };

  const handleCreateTrade = async () => {
    if (!selectedItem) {
      showAlert('Select an item', 'Choose an item from your wardrobe to offer.');
      return;
    }
    setSubmitting(true);
    const result = await createTradeRequest({
      targetFirebaseUid: otherFirebaseUid,
      offeredItemId: selectedItem.id,
      wantedItemId: null,
      tradeType,
      lat: userLocation?.lat,
      lng: userLocation?.lng,
    });
    setSubmitting(false);
    if (result.success) {
      showAlert('Trade Sent!', "Your request has been sent. You'll be notified when they respond.", [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      showAlert('Error', result.error || 'Failed to create trade request');
    }
  };

  const handleAccept = async () => {
    setSubmitting(true);
    const result = await respondToTrade(tradeRequestId, 'accept', userLocation?.lat, userLocation?.lng);
    setSubmitting(false);
    if (result.success) {
      loadTradeRequest();
    } else {
      showAlert('Error', result.error || 'Failed to accept trade');
    }
  };

  const handleDecline = async () => {
    showAlert('Decline Trade', 'Are you sure you want to decline this trade request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          await respondToTrade(tradeRequestId, 'decline');
          setSubmitting(false);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleComplete = async () => {
    showAlert('Complete Trade', 'Confirm that the swap has been completed at the dropbox?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          setSubmitting(true);
          await completeTrade(tradeRequestId);
          setSubmitting(false);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleChangeShop = async () => {
    if (!trade) return;
    setShopModalVisible(true);
    setShopsLoading(true);
    const lat = trade.charity_shop_lat || userLocation?.lat;
    const lng = trade.charity_shop_lng || userLocation?.lng;
    if (lat && lng) {
      const result = await fetchNearbyShopsForTrade(lat, lng);
      if (result.success) setNearbyShops(result.shops || []);
    }
    setShopsLoading(false);
  };

  const selectShop = async (shop) => {
    setShopModalVisible(false);
    setSubmitting(true);
    await updateTradeShop(tradeRequestId, shop);
    setSubmitting(false);
    loadTradeRequest();
  };

  // ================================
  // CREATE MODE
  // ================================
  if (mode === 'create') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Trade</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.toLabel}>To: <Text style={{ color: colors.primary, fontWeight: '700' }}>{otherUserName || 'User'}</Text></Text>

            {/* Trade type */}
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, tradeType === 'free' && styles.typeBtnActive]}
                onPress={() => setTradeType('free')}
                accessibilityRole="button"
                accessibilityLabel="Give for free"
                accessibilityState={{ selected: tradeType === 'free' }}
              >
                <Ionicons name="gift-outline" size={20} color={tradeType === 'free' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.typeBtnText, tradeType === 'free' && styles.typeBtnTextActive]}>Give for Free</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, tradeType === 'trade' && styles.typeBtnActive]}
                onPress={() => setTradeType('trade')}
                accessibilityRole="button"
                accessibilityLabel="Trade for item"
                accessibilityState={{ selected: tradeType === 'trade' }}
              >
                <Ionicons name="swap-horizontal-outline" size={20} color={tradeType === 'trade' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.typeBtnText, tradeType === 'trade' && styles.typeBtnTextActive]}>Trade for Item</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Choose item to offer</Text>
            {myItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="shirt-outline" size={40} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No items in your wardrobe. Import some scans first!</Text>
              </View>
            ) : (
              <FlatList
                data={myItems}
                horizontal
                keyExtractor={(item) => String(item.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.itemScroll}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.itemCard, selectedItem?.id === item.id && styles.itemCardSelected]}
                    onPress={() => setSelectedItem(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name || 'Item'} by ${item.brand || 'unknown brand'}`}
                    accessibilityState={{ selected: selectedItem?.id === item.id }}
                  >
                    {(item.thumbnailUrl || item.imageUrl) ? (
                      <Image source={{ uri: item.thumbnailUrl || item.imageUrl }} style={styles.itemImage} />
                    ) : (
                      <View style={[styles.itemImage, styles.itemPlaceholder]}>
                        <Ionicons name="shirt-outline" size={24} color={colors.textTertiary} />
                      </View>
                    )}
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemBrand} numberOfLines={1}>{item.brand}</Text>
                    {item.environmentalGrade && (
                      <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(item.environmentalGrade) }]}>
                        <Text style={styles.gradeText}>{item.environmentalGrade}</Text>
                      </View>
                    )}
                    {selectedItem?.id === item.id && (
                      <View style={styles.checkOverlay}>
                        <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}

            {tradeType === 'trade' && (
              <View style={styles.infoNote}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.infoNoteText}>
                  The other person will choose which of their items to swap when they accept.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, (!selectedItem || submitting) && styles.submitBtnDisabled]}
              onPress={handleCreateTrade}
              disabled={!selectedItem || submitting}
              accessibilityRole="button"
              accessibilityLabel={tradeType === 'free' ? 'Offer for free' : 'Send trade request'}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name={tradeType === 'free' ? 'gift-outline' : 'swap-horizontal-outline'} size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>
                    {tradeType === 'free' ? 'Offer for Free' : 'Send Trade Request'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ================================
  // VIEW MODE
  // ================================
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trade Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!trade) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trade Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { marginTop: spacing.md }]}>Trade not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isMyTrade = trade.requester_firebase_uid === user?.uid;
  const isPending = trade.status === 'pending';
  const isAccepted = trade.status === 'accepted';
  const isCompleted = trade.status === 'completed';
  const isDeclined = trade.status === 'declined';
  const statusCfg = STATUS_CONFIG[trade.status] || STATUS_CONFIG.pending;

  const myPin = isMyTrade ? trade.requester_pin : trade.recipient_pin;
  const myCompartment = isMyTrade ? trade.requester_compartment : trade.recipient_compartment;
  const pinDigits = myPin ? String(myPin).split('') : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trade Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusCfg.bg }]}>
          <View style={[styles.statusIconCircle, { backgroundColor: statusCfg.color + '22' }]}>
            <Ionicons name={statusCfg.icon} size={28} color={statusCfg.color} />
          </View>
          <View style={styles.statusTextBlock}>
            <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            <Text style={styles.statusSub}>
              {trade.trade_type === 'free' ? 'Free Giveaway' : 'Item Swap'} ·{' '}
              {new Date(trade.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Participants */}
        <View style={styles.participantsRow}>
          <View style={styles.participant}>
            <View style={styles.participantAvatar}>
              <Text style={styles.participantInitial}>
                {(trade.requester_name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.participantName} numberOfLines={1}>{trade.requester_name || 'User'}</Text>
            <Text style={styles.participantRole}>Sender</Text>
          </View>
          <View style={styles.participantArrow}>
            <Ionicons
              name={trade.trade_type === 'free' ? 'arrow-forward' : 'swap-horizontal'}
              size={24}
              color={colors.primary}
            />
          </View>
          <View style={styles.participant}>
            <View style={styles.participantAvatar}>
              <Text style={styles.participantInitial}>
                {(trade.recipient_name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.participantName} numberOfLines={1}>{trade.recipient_name || 'User'}</Text>
            <Text style={styles.participantRole}>Recipient</Text>
          </View>
        </View>

        {/* Items being traded */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.itemsRow}>
            {/* Offered item */}
            <View style={styles.tradeItemCard}>
              <Text style={styles.tradeItemRole}>Offered</Text>
              {(trade.offered_item_thumbnail || trade.offered_item_image) ? (
                <Image
                  source={{ uri: trade.offered_item_thumbnail || trade.offered_item_image }}
                  style={styles.tradeItemImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.tradeItemImage, styles.itemPlaceholder]}>
                  <Ionicons name="shirt-outline" size={32} color={colors.textTertiary} />
                </View>
              )}
              <Text style={styles.tradeItemName} numberOfLines={2}>{trade.offered_item_name || 'Item'}</Text>
              {trade.offered_item_brand ? (
                <Text style={styles.tradeItemBrand}>{trade.offered_item_brand}</Text>
              ) : null}
            </View>

            <View style={styles.itemsArrow}>
              <Ionicons
                name={trade.trade_type === 'free' ? 'arrow-forward-circle' : 'swap-horizontal'}
                size={32}
                color={colors.primary}
              />
            </View>

            {/* Wanted / free side */}
            <View style={styles.tradeItemCard}>
              {trade.trade_type === 'free' ? (
                <>
                  <Text style={styles.tradeItemRole}>Free!</Text>
                  <View style={[styles.tradeItemImage, styles.freeIconBox]}>
                    <Ionicons name="gift" size={36} color={colors.primary} />
                  </View>
                  <Text style={styles.tradeItemName}>No item needed</Text>
                </>
              ) : trade.wanted_item_name ? (
                <>
                  <Text style={styles.tradeItemRole}>In return</Text>
                  {(trade.wanted_item_thumbnail || trade.wanted_item_image) ? (
                    <Image
                      source={{ uri: trade.wanted_item_thumbnail || trade.wanted_item_image }}
                      style={styles.tradeItemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.tradeItemImage, styles.itemPlaceholder]}>
                      <Ionicons name="shirt-outline" size={32} color={colors.textTertiary} />
                    </View>
                  )}
                  <Text style={styles.tradeItemName} numberOfLines={2}>{trade.wanted_item_name}</Text>
                  {trade.wanted_item_brand ? (
                    <Text style={styles.tradeItemBrand}>{trade.wanted_item_brand}</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.tradeItemRole}>In return</Text>
                  <View style={[styles.tradeItemImage, styles.itemPlaceholder]}>
                    <Ionicons name="help-circle-outline" size={32} color={colors.textTertiary} />
                  </View>
                  <Text style={styles.tradeItemName}>Recipient chooses</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Dropbox section — only when accepted or completed */}
        {(isAccepted || isCompleted) && (
          <>
            {/* Charity shop */}
            <View style={styles.shopSection}>
              <Text style={styles.sectionTitle}>Dropbox Location</Text>
              {trade.charity_shop_name ? (
                <View style={styles.shopCard}>
                  <View style={styles.shopIconBox}>
                    <Ionicons name="storefront" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.shopInfo}>
                    <Text style={styles.shopName}>{trade.charity_shop_name}</Text>
                    <Text style={styles.shopAddress}>{trade.charity_shop_address}</Text>
                  </View>
                  {isAccepted && (
                    <TouchableOpacity style={styles.changeShopBtn} onPress={handleChangeShop} accessibilityRole="button" accessibilityLabel="Change charity shop">
                      <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                      <Text style={styles.changeShopText}>Change</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity style={styles.shopCard} onPress={handleChangeShop} accessibilityRole="button" accessibilityLabel="Find a charity shop">
                  <Ionicons name="location-outline" size={22} color={colors.textTertiary} />
                  <Text style={[styles.shopName, { color: colors.primary, marginLeft: spacing.sm }]}>
                    Find a charity shop
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* YOUR PIN */}
            <View style={styles.pinSection}>
              <Text style={styles.sectionTitle}>Your Dropbox Access</Text>
              <View style={styles.pinCard}>
                <View style={styles.pinHeader}>
                  <Ionicons name="key" size={18} color={colors.primary} />
                  <Text style={styles.pinHeaderText}>Your PIN Code</Text>
                </View>
                <View style={styles.pinDigitsRow}>
                  {pinDigits.map((d, i) => (
                    <View key={i} style={styles.pinDigitBox}>
                      <Text style={styles.pinDigit}>{d}</Text>
                    </View>
                  ))}
                </View>
                {/* For free: one compartment label. For swap: show drop-off + collect-from */}
                {trade.trade_type === 'free' ? (
                  <View style={styles.compartmentRow}>
                    <View style={styles.compartmentBox}>
                      <Text style={styles.compartmentLabel}>
                        {isMyTrade ? 'Drop off in compartment' : 'Collect from compartment'}
                      </Text>
                      <Text style={styles.compartmentNumber}>#{myCompartment}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.compartmentRowDouble}>
                    <View style={styles.compartmentBox}>
                      <Text style={styles.compartmentLabel}>Drop off in</Text>
                      <Text style={styles.compartmentNumber}>#{myCompartment}</Text>
                    </View>
                    <View style={styles.compartmentDivider} />
                    <View style={styles.compartmentBox}>
                      <Text style={styles.compartmentLabel}>Collect from</Text>
                      <Text style={styles.compartmentNumber}>
                        #{isMyTrade ? trade.recipient_compartment : trade.requester_compartment}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Steps */}
              <View style={styles.stepsCard}>
                <Text style={styles.stepsTitle}>How it works</Text>
                {(() => {
                  const isFree = trade.trade_type === 'free';
                  // for a swap, each user has their own compartment; for free both share compartment 1
                  const theirCompartment = isMyTrade ? trade.recipient_compartment : trade.requester_compartment;
                  const steps = [
                    { n: '1', text: `Go to ${trade.charity_shop_name || 'the charity shop'}` },
                    { n: '2', text: `Find the dropbox and locate compartment #${myCompartment}` },
                    { n: '3', text: `Enter your PIN to unlock it` },
                    isFree
                      ? isMyTrade
                        ? { n: '4', text: 'Leave your item inside and close the compartment' }
                        : { n: '4', text: 'Collect your item from inside the compartment' }
                      : { n: '4', text: `Leave your item in compartment #${myCompartment}, then collect the other item from compartment #${theirCompartment}` },
                  ];
                  return steps.map(step => (
                    <View key={step.n} style={styles.step}>
                      <View style={styles.stepBubble}>
                        <Text style={styles.stepNum}>{step.n}</Text>
                      </View>
                      <Text style={styles.stepText}>{step.text}</Text>
                    </View>
                  ));
                })()}
              </View>
            </View>
          </>
        )}

        {/* Pending — waiting state for sender */}
        {isPending && isMyTrade && (
          <View style={styles.waitingCard}>
            <Ionicons name="hourglass-outline" size={28} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.waitingTitle}>Waiting for a response</Text>
              <Text style={styles.waitingBody}>{trade.recipient_name || 'The other person'} hasn't responded yet.</Text>
            </View>
          </View>
        )}

        {/* Action buttons */}
        {isPending && !isMyTrade && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} disabled={submitting} accessibilityRole="button" accessibilityLabel="Decline trade request">
              <Ionicons name="close" size={20} color="#EF4444" />
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} disabled={submitting} accessibilityRole="button" accessibilityLabel="Accept trade request">
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.acceptBtnText}>Accept Trade</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isAccepted && (
          <TouchableOpacity style={styles.completeBtn} onPress={handleComplete} disabled={submitting} accessibilityRole="button" accessibilityLabel="Mark trade as completed">
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-done" size={20} color="#fff" />
                <Text style={styles.completeBtnText}>Mark as Completed</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isDeclined && (
          <View style={[styles.waitingCard, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="close-circle-outline" size={28} color="#EF4444" />
            <Text style={[styles.waitingTitle, { color: '#EF4444', marginLeft: spacing.sm }]}>This trade was declined.</Text>
          </View>
        )}

        {isCompleted && (
          <View style={[styles.waitingCard, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="trophy" size={28} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[styles.waitingTitle, { color: colors.primary }]}>Trade complete!</Text>
              <Text style={styles.waitingBody}>Thanks for choosing sustainable swapping.</Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Shop picker modal */}
      <Modal visible={shopModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Charity Shop</Text>
              <TouchableOpacity onPress={() => setShopModalVisible(false)} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Close shop picker">
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Shops near the trade midpoint</Text>
            {shopsLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : nearbyShops.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="storefront-outline" size={40} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { marginTop: spacing.md }]}>No charity shops found nearby.</Text>
              </View>
            ) : (
              <FlatList
                data={nearbyShops}
                keyExtractor={(item, idx) => `${item.name}-${idx}`}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.shopOption} onPress={() => selectShop(item)} accessibilityRole="button" accessibilityLabel={`Select ${item.name}`}>
                    <View style={styles.shopOptionIcon}>
                      <Ionicons name="storefront-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.shopOptionInfo}>
                      <Text style={styles.shopOptionName}>{item.name}</Text>
                      <Text style={styles.shopOptionAddress}>{item.address}</Text>
                    </View>
                    <Text style={styles.shopOptionDistance}>
                      {item.distance < 1000 ? `${item.distance}m` : `${(item.distance / 1000).toFixed(1)}km`}
                    </Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: spacing.xl }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  // ---- Create mode ----
  toLabel: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceSecondary, gap: spacing.xs,
  },
  typeBtnActive: { backgroundColor: colors.primary },
  typeBtnText: { ...typography.body, fontWeight: '600', color: colors.textSecondary },
  typeBtnTextActive: { color: '#fff' },

  sectionTitle: { ...typography.h3, marginBottom: spacing.md },

  itemScroll: { paddingBottom: spacing.sm, paddingTop: spacing.xs },
  itemCard: {
    width: 120, marginRight: spacing.sm, backgroundColor: colors.surface,
    borderRadius: borderRadius.md, padding: spacing.sm, ...shadows.soft,
    borderWidth: 2, borderColor: 'transparent',
  },
  itemCardSelected: { borderColor: colors.primary },
  itemImage: { width: '100%', height: 100, borderRadius: borderRadius.xs, marginBottom: spacing.xs },
  itemPlaceholder: { backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  itemName: { ...typography.bodySmall, fontWeight: '600' },
  itemBrand: { ...typography.caption, color: colors.textTertiary },
  gradeBadge: {
    position: 'absolute', top: spacing.xs, right: spacing.xs,
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  gradeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  checkOverlay: { position: 'absolute', top: spacing.xs, left: spacing.xs },

  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  infoNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm,
    padding: spacing.md, marginTop: spacing.md,
  },
  infoNoteText: { ...typography.bodySmall, color: colors.primary, flex: 1, lineHeight: 20 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md,
    borderRadius: borderRadius.md, marginTop: spacing.lg,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { ...typography.button, color: '#fff' },

  // ---- View mode ----

  // Status banner
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.lg, gap: spacing.md,
  },
  statusIconCircle: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
  },
  statusTextBlock: { flex: 1 },
  statusLabel: { ...typography.h3, fontWeight: '700' },
  statusSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  // Participants
  participantsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.lg, ...shadows.soft,
  },
  participant: { flex: 1, alignItems: 'center' },
  participantAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs, borderWidth: 2, borderColor: colors.primary,
  },
  participantInitial: { fontSize: 20, fontWeight: '800', color: colors.primary },
  participantName: { ...typography.bodySmall, fontWeight: '700', textAlign: 'center' },
  participantRole: { ...typography.caption, color: colors.textTertiary },
  participantArrow: { paddingHorizontal: spacing.md },

  // Items section
  itemsSection: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.lg, ...shadows.soft,
  },
  itemsRow: { flexDirection: 'row', alignItems: 'center' },
  tradeItemCard: {
    flex: 1, alignItems: 'center',
  },
  tradeItemRole: {
    ...typography.caption, color: colors.textTertiary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm,
  },
  tradeItemImage: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2 - 48) / 2,
    height: (SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2 - 48) / 2,
    borderRadius: borderRadius.md, marginBottom: spacing.sm,
  },
  tradeItemName: { ...typography.bodySmall, fontWeight: '600', textAlign: 'center' },
  tradeItemBrand: { ...typography.caption, color: colors.textTertiary, textAlign: 'center' },
  freeIconBox: {
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  itemsArrow: { paddingHorizontal: spacing.sm, alignItems: 'center' },

  // Shop section
  shopSection: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.lg, ...shadows.soft,
  },
  shopCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.md, padding: spacing.md,
  },
  shopIconBox: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  shopInfo: { flex: 1 },
  shopName: { ...typography.body, fontWeight: '700' },
  shopAddress: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  changeShopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm,
  },
  changeShopText: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  // PIN section
  pinSection: {
    marginBottom: spacing.lg,
  },
  pinCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, ...shadows.soft, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.primary + '33',
  },
  pinHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  pinHeaderText: { ...typography.bodySmall, fontWeight: '700', color: colors.primary },
  pinDigitsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pinDigitBox: {
    width: 44, height: 56, borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.primary,
  },
  pinDigit: { fontSize: 26, fontWeight: '800', color: colors.primary },
  compartmentRow: { alignItems: 'center' },
  compartmentRowDouble: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%',
  },
  compartmentDivider: { width: 1, height: 48, backgroundColor: colors.border },
  compartmentBox: { alignItems: 'center' },
  compartmentLabel: { ...typography.caption, color: colors.textTertiary, marginBottom: 4 },
  compartmentNumber: { fontSize: 32, fontWeight: '800', color: colors.textPrimary },

  // Steps
  stepsCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, ...shadows.soft, gap: spacing.md,
  },
  stepsTitle: { ...typography.bodySmall, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.xs },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  stepBubble: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNum: { fontSize: 13, fontWeight: '800', color: '#fff' },
  stepText: { ...typography.body, flex: 1, lineHeight: 22, paddingTop: 3 },

  // Waiting card
  waitingCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFBEB', borderRadius: borderRadius.lg,
    padding: spacing.md, marginTop: spacing.md, gap: spacing.md, ...shadows.soft,
  },
  waitingTitle: { ...typography.body, fontWeight: '700', color: '#92400E' },
  waitingBody: { ...typography.bodySmall, color: '#B45309', marginTop: 2 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  declineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: '#EF4444', gap: spacing.xs,
  },
  declineBtnText: { ...typography.button, color: '#EF4444' },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, borderRadius: borderRadius.md,
    backgroundColor: colors.primary, gap: spacing.xs,
  },
  acceptBtnText: { ...typography.button, color: '#fff' },

  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingVertical: spacing.md,
    borderRadius: borderRadius.md, marginTop: spacing.lg, gap: spacing.xs,
  },
  completeBtnText: { ...typography.button, color: '#fff' },

  // Shop picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl, maxHeight: '70%', padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalClose: { padding: spacing.xs },
  modalTitle: { ...typography.h3 },
  modalSubtitle: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.md },
  shopOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md,
  },
  shopOptionIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  shopOptionInfo: { flex: 1 },
  shopOptionName: { ...typography.body, fontWeight: '600' },
  shopOptionAddress: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  shopOptionDistance: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});

export default TradeScreen;
