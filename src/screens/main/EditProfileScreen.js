// author: caitriona mccann
// date: 09/02/2026
// edit profile screen - update display name, bio, and privacy settings
// saves changes via socialApi.updateUserProfile

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { updateUserProfile } from '../../services/api';
import { uploadScanImages } from '../../services/imageUpload';
import { useAlert } from '../../context/AlertContext';

const PRIVACY_OPTIONS = [
  { key: 'public', label: 'Public', description: 'Anyone can see your profile and posts' },
  { key: 'followers', label: 'Followers Only', description: 'Only followers can see your posts' },
  { key: 'private', label: 'Private', description: 'Only you can see your profile details' },
];

const EditProfileScreen = () => {
  const { showAlert } = useAlert();
  const navigation = useNavigation();
  const route = useRoute();
  const { profile } = route.params || {};

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [privacyLevel, setPrivacyLevel] = useState(profile?.privacy_level || 'public');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handlePickAvatar = async () => {
    if (uploadingAvatar) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission needed', 'Please allow photo library access to upload an avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingAvatar(true);
      const uploadResult = await uploadScanImages(result.assets[0].uri, `avatar-${Date.now()}`);
      setUploadingAvatar(false);

      if (uploadResult.success && uploadResult.imageUrl) {
        setAvatarUrl(uploadResult.imageUrl);

        const saveAvatarResult = await updateUserProfile({
          displayName: displayName.trim() || profile?.display_name || null,
          bio: bio.trim() || profile?.bio || null,
          privacyLevel,
          avatarUrl: uploadResult.imageUrl,
        });

        if (!saveAvatarResult.success) {
          showAlert('Upload saved locally', 'Image uploaded but profile update failed. Tap Save Changes to retry.');
        }
      } else {
        showAlert('Upload failed', uploadResult.error || 'Could not upload avatar image.');
      }
    } catch (error) {
      setUploadingAvatar(false);
      showAlert('Error', error.message || 'Failed to select image.');
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      showAlert('Required', 'Please enter a display name.');
      return;
    }

    setSaving(true);
    const result = await updateUserProfile({
      displayName: displayName.trim(),
      bio: bio.trim(),
      privacyLevel,
      avatarUrl,
    });

    setSaving(false);

    if (result.success) {
      showAlert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      showAlert('Error', result.error || 'Failed to update profile.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

          <Text style={styles.title}>Edit Profile</Text>

          {/* Avatar Preview */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {(displayName || '?')[0].toUpperCase()}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.avatarButton} onPress={handlePickAvatar} disabled={uploadingAvatar}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.avatarButtonText}>Upload Profile Picture</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Display Name */}
          <Card style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your display name"
              placeholderTextColor={colors.textTertiary}
              maxLength={50}
              autoCapitalize="words"
              accessibilityLabel="Display name"
              accessibilityHint="Enter the name other users will see"
            />
            <Text style={styles.charCount}>{displayName.length}/50</Text>
          </Card>

          {/* Bio */}
          <Card style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell others about your sustainability journey..."
              placeholderTextColor={colors.textTertiary}
              maxLength={200}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel="Bio"
              accessibilityHint="A short description of yourself shown on your public profile"
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </Card>

          {/* Privacy */}
          <Card style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>Privacy Level</Text>
            {PRIVACY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[styles.privacyOption, privacyLevel === option.key && styles.privacyOptionActive]}
                onPress={() => setPrivacyLevel(option.key)}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityHint={option.description}
                accessibilityState={{ checked: privacyLevel === option.key }}
              >
                <View style={styles.radioOuter}>
                  {privacyLevel === option.key && <View style={styles.radioInner} />}
                </View>
                <View style={styles.privacyInfo}>
                  <Text style={[styles.privacyLabel, privacyLevel === option.key && styles.privacyLabelActive]}>
                    {option.label}
                  </Text>
                  <Text style={styles.privacyDesc}>{option.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Card>

          {/* Save Button */}
          <Button
            title={saving ? 'Saving...' : 'Save Changes'}
            onPress={handleSave}
            disabled={saving}
          />

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButton: {
    marginBottom: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.full,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
  },
  avatarButton: {
    marginTop: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  avatarButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  fieldCard: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
  },
  privacyOptionActive: {
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  privacyInfo: {
    flex: 1,
  },
  privacyLabel: {
    ...typography.body,
    fontWeight: '500',
  },
  privacyLabelActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  privacyDesc: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  cancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

export default EditProfileScreen;
