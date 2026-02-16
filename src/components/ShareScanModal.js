// author: caitriona mccann
// date: 09/02/2026
// share scan modal - shown after scan to let users share to their public feed
// supports toggle between public/private and optional caption

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, typography, spacing, borderRadius, shadows, getGradeColor } from '../theme/theme';
import Button from './Button';

const ShareScanModal = ({ visible, onClose, onShare, scanData }) => {
  const [isPublic, setIsPublic] = useState(true);
  const [caption, setCaption] = useState('');
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      await onShare({
        isPublic,
        caption: caption.trim(),
      });
    } finally {
      setSharing(false);
      setCaption('');
      setIsPublic(true);
    }
  };

  const handleSkip = () => {
    setCaption('');
    setIsPublic(true);
    onClose();
  };

  const grade = scanData?.grade || scanData?.environmental_grade || 'C';
  const brand = scanData?.brand || 'Unknown';
  const itemType = scanData?.itemType || scanData?.item_type || 'Garment';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleSkip}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <View style={styles.handle} />

          <Text style={styles.title}>Share This Scan?</Text>
          <Text style={styles.subtitle}>
            Let the community see your {brand} {itemType} scan
          </Text>

          {/* Scan Preview */}
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(grade) }]}>
                <Text style={styles.gradeText}>{grade}</Text>
              </View>
              <View style={styles.previewInfo}>
                <Text style={styles.previewBrand}>{brand}</Text>
                <Text style={styles.previewType}>{itemType}</Text>
              </View>
            </View>
          </View>

          {/* Caption Input */}
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption (optional)..."
            placeholderTextColor={colors.textTertiary}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={280}
            numberOfLines={3}
          />

          {/* Public/Private Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>
                {isPublic ? 'Public' : 'Private'}
              </Text>
              <Text style={styles.toggleDescription}>
                {isPublic
                  ? 'Visible to followers and on your profile'
                  : 'Only visible to you'}
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={sharing ? 'Sharing...' : 'Share Scan'}
              onPress={handleShare}
              loading={sharing}
              disabled={sharing}
            />
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  previewCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradeBadge: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  gradeText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.background,
  },
  previewInfo: {
    flex: 1,
  },
  previewBrand: {
    ...typography.body,
    fontWeight: '700',
  },
  previewType: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  captionInput: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toggleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  toggleDescription: {
    ...typography.caption,
    marginTop: 2,
  },
  actions: {
    gap: spacing.sm,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

export default ShareScanModal;
