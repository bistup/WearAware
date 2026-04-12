// author: caitriona mccann
// date: 12/03/2026
// outfits screen - create outfits from wardrobe items and plan weekly looks
// swipe through days of the week, add/remove items to build outfits

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows, getGradeColor } from '../../theme/theme';
import {
  fetchWeeklyOutfits,
  fetchOutfits,
  createOutfit,
  updateOutfit,
  deleteOutfit,
  fetchWardrobe,
} from '../../services/api';
import { useAlert } from '../../context/AlertContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

const getTodayName = () => {
  return DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
};

const OutfitsScreen = () => {
  const { showAlert } = useAlert();
  const navigation = useNavigation();
  const [activeDay, setActiveDay] = useState(getTodayName());
  const [weekly, setWeekly] = useState({});
  const [allOutfits, setAllOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [wardrobeLoading, setWardrobeLoading] = useState(false);

  // create form state
  const [newName, setNewName] = useState('');
  const [newDay, setNewDay] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    const [weeklyResult, allResult] = await Promise.all([
      fetchWeeklyOutfits(),
      fetchOutfits(),
    ]);
    if (weeklyResult.success) setWeekly(weeklyResult.weekly || {});
    if (allResult.success) setAllOutfits(allResult.outfits || []);
    setLoading(false);
  };

  const loadWardrobeForPicker = async () => {
    setWardrobeLoading(true);
    const result = await fetchWardrobe('All');
    if (result.success) {
      setWardrobeItems(result.items || []);
    }
    setWardrobeLoading(false);
  };

  const handleOpenCreate = () => {
    setNewName('');
    setNewDay(activeDay);
    setSelectedItems([]);
    setShowCreateModal(true);
    loadWardrobeForPicker();
  };

  const handleToggleItem = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      return [...prev, item];
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      showAlert('Name Required', 'Give your outfit a name');
      return;
    }
    if (selectedItems.length === 0) {
      showAlert('Add Items', 'Select at least one item for this outfit');
      return;
    }

    const result = await createOutfit({
      name: newName.trim(),
      dayOfWeek: newDay,
      itemIds: selectedItems.map(i => i.id),
    });

    if (result.success) {
      setShowCreateModal(false);
      loadData();
    } else {
      showAlert('Error', result.error || 'Failed to create outfit');
    }
  };

  const handleDelete = (outfit) => {
    showAlert(
      'Delete Outfit',
      `Delete "${outfit.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteOutfit(outfit.id);
            if (result.success) loadData();
          },
        },
      ]
    );
  };

  const dayOutfits = weekly[activeDay] || [];
  const unassignedOutfits = allOutfits.filter(o => !o.dayOfWeek);

  const renderOutfitCard = (outfit) => {
    const itemImages = outfit.items.slice(0, 4);
    const extraCount = outfit.items.length > 4 ? outfit.items.length - 4 : 0;

    return (
      <View key={outfit.id} style={styles.outfitCard}>
        <View style={styles.outfitHeader}>
          <View style={styles.outfitNameRow}>
            <Text style={styles.outfitName}>{outfit.name}</Text>
            <Text style={styles.outfitItemCount}>{outfit.items.length} items</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(outfit)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Delete outfit ${outfit.name}`}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Item thumbnails grid */}
        <View style={styles.outfitItemsGrid}>
          {itemImages.map((item, idx) => {
            const imageUri = item.thumbnailUrl || item.imageUrl;
            return (
              <View key={idx} style={styles.outfitItemThumb}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.outfitItemImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.outfitItemImage, styles.outfitItemPlaceholder]}>
                    <Ionicons name="shirt-outline" size={20} color={colors.textTertiary} />
                  </View>
                )}
                <Text style={styles.outfitItemName} numberOfLines={1}>{item.name}</Text>
                {item.category && (
                  <Text style={styles.outfitItemCategory} numberOfLines={1}>{item.category}</Text>
                )}
              </View>
            );
          })}
          {extraCount > 0 && (
            <View style={styles.outfitItemThumb}>
              <View style={[styles.outfitItemImage, styles.outfitItemExtra]}>
                <Text style={styles.outfitExtraText}>+{extraCount}</Text>
              </View>
            </View>
          )}
        </View>

        {outfit.notes && (
          <Text style={styles.outfitNotes}>{outfit.notes}</Text>
        )}
      </View>
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
        <View style={styles.headerRow}>
          <Text style={styles.title}>Outfits</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleOpenCreate}>
            <Ionicons name="add" size={20} color={colors.background} />
            <Text style={styles.addButtonText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day tabs */}
      <View style={styles.dayTabsWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabs}
      >
        {DAYS.map((day) => {
          const isToday = day === getTodayName();
          const isActive = day === activeDay;
          const hasOutfits = (weekly[day] || []).length > 0;

          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayTab, isActive && styles.dayTabActive]}
              onPress={() => setActiveDay(day)}
            >
              <Text style={[styles.dayTabText, isActive && styles.dayTabTextActive]}>
                {DAY_SHORT[day]}
              </Text>
              {isToday && <View style={[styles.todayDot, isActive && styles.todayDotActive]} />}
              {hasOutfits && !isActive && <View style={styles.outfitDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Day's outfits */}
          <Text style={styles.sectionTitle}>
            {activeDay === getTodayName() ? "Today's Outfits" : `${activeDay}'s Outfits`}
          </Text>

          {dayOutfits.length > 0 ? (
            dayOutfits.map(renderOutfitCard)
          ) : (
            <View style={styles.emptyDay}>
              <Ionicons name="shirt-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyDayText}>No outfits planned for {activeDay}</Text>
              <TouchableOpacity style={styles.emptyDayAction} onPress={handleOpenCreate}>
                <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.emptyDayActionText}>Plan an outfit</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Unassigned outfits */}
          {unassignedOutfits.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Saved Outfits</Text>
              {unassignedOutfits.map(renderOutfitCard)}
            </>
          )}
        </ScrollView>
      )}

      {/* Create Outfit Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Outfit</Text>
            <TouchableOpacity onPress={handleCreate}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Name input */}
            <Text style={styles.fieldLabel}>Outfit Name</Text>
            <TextInput
              style={styles.textInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Casual Friday, Gym Look..."
              placeholderTextColor={colors.textTertiary}
            />

            {/* Day picker */}
            <Text style={styles.fieldLabel}>Day of the Week (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayPickerRow}
            >
              <TouchableOpacity
                style={[styles.dayPickerChip, !newDay && styles.dayPickerChipActive]}
                onPress={() => setNewDay(null)}
              >
                <Text style={[styles.dayPickerText, !newDay && styles.dayPickerTextActive]}>None</Text>
              </TouchableOpacity>
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayPickerChip, newDay === day && styles.dayPickerChipActive]}
                  onPress={() => setNewDay(day)}
                >
                  <Text style={[styles.dayPickerText, newDay === day && styles.dayPickerTextActive]}>
                    {DAY_SHORT[day]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Selected items preview */}
            {selectedItems.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Selected ({selectedItems.length})</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectedRow}
                >
                  {selectedItems.map((item) => {
                    const imageUri = item.thumbnailUrl || item.imageUrl;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.selectedThumb}
                        onPress={() => handleToggleItem(item)}
                      >
                        {imageUri ? (
                          <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.selectedImage, styles.selectedPlaceholder]}>
                            <Ionicons name="shirt-outline" size={18} color={colors.textTertiary} />
                          </View>
                        )}
                        <View style={styles.selectedRemove}>
                          <Ionicons name="close-circle" size={18} color="#E53E3E" />
                        </View>
                        <Text style={styles.selectedName} numberOfLines={1}>{item.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Wardrobe items picker */}
            <Text style={styles.fieldLabel}>Add from Wardrobe</Text>
            {wardrobeLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
            ) : wardrobeItems.length === 0 ? (
              <View style={styles.emptyWardrobe}>
                <Text style={styles.emptyWardrobeText}>No items in your wardrobe yet</Text>
              </View>
            ) : (
              <View style={styles.pickerGrid}>
                {wardrobeItems.map((item) => {
                  const imageUri = item.thumbnailUrl || item.imageUrl;
                  const isSelected = selectedItems.some(i => i.id === item.id);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.pickerCard, isSelected && styles.pickerCardSelected]}
                      onPress={() => handleToggleItem(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.pickerImageContainer}>
                        {imageUri ? (
                          <Image source={{ uri: imageUri }} style={styles.pickerImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.pickerImage, styles.pickerPlaceholder]}>
                            <Ionicons name="shirt-outline" size={24} color={colors.textTertiary} />
                          </View>
                        )}
                        {isSelected && (
                          <View style={styles.pickerCheck}>
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.pickerName} numberOfLines={1}>{item.name}</Text>
                      {item.category && item.category !== 'General' && (
                        <Text style={styles.pickerCategory} numberOfLines={1}>{item.category}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    paddingBottom: spacing.xs,
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  addButtonText: {
    ...typography.bodySmall,
    color: colors.background,
    fontWeight: '700',
  },
  // day tabs
  dayTabsWrapper: {
    height: 56,
  },
  dayTabs: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  dayTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceSecondary,
    marginRight: 8,
    minWidth: 50,
    height: 40,
  },
  dayTabActive: {
    backgroundColor: colors.primary,
  },
  dayTabText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dayTabTextActive: {
    color: '#FFFFFF',
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 3,
  },
  todayDotActive: {
    backgroundColor: '#FFFFFF',
  },
  outfitDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.secondary,
    marginTop: 3,
  },
  // content
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // outfit card
  outfitCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  outfitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  outfitNameRow: {
    flex: 1,
  },
  outfitName: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  outfitItemCount: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  outfitItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  outfitItemThumb: {
    width: 72,
    alignItems: 'center',
  },
  outfitItemImage: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  outfitItemPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  outfitItemExtra: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  outfitExtraText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  outfitItemName: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  outfitItemCategory: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 10,
  },
  outfitNotes: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  // empty day
  emptyDay: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyDayText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  emptyDayAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  emptyDayActionText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  // modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  modalSave: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  fieldLabel: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  // day picker
  dayPickerRow: {
    gap: spacing.xs,
  },
  dayPickerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    marginRight: spacing.xs,
  },
  dayPickerChipActive: {
    backgroundColor: colors.primary,
  },
  dayPickerText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayPickerTextActive: {
    color: '#FFFFFF',
  },
  // selected items
  selectedRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  selectedThumb: {
    width: 72,
    alignItems: 'center',
  },
  selectedImage: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  selectedPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRemove: {
    position: 'absolute',
    top: -4,
    right: 0,
    backgroundColor: colors.background,
    borderRadius: 9,
  },
  selectedName: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  // wardrobe picker grid
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  pickerCard: {
    width: '30%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  pickerCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  pickerImageContainer: {
    width: '100%',
    height: 90,
    backgroundColor: colors.surfaceSecondary,
  },
  pickerImage: {
    width: '100%',
    height: '100%',
  },
  pickerPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  pickerName: {
    ...typography.caption,
    fontWeight: '600',
    padding: spacing.xs,
    paddingBottom: 2,
  },
  pickerCategory: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 10,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  // empty wardrobe in modal
  emptyWardrobe: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyWardrobeText: {
    ...typography.body,
    color: colors.textTertiary,
  },
});

export default OutfitsScreen;
