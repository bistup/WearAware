// author: caitriona mccann
// date: 12/04/2026
// data privacy & gdpr screen - explains what data is stored, how it is used,
// and gives the user options to delete their images or their full account

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { deleteUser } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAlert } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';
import { deleteAllMyImages } from '../../services/imageUpload';
import { deleteMyAccount } from '../../services/api';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const DataPrivacyScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = () => {
    showAlert(
      'Delete Account',
      'This will permanently delete your account and ALL associated data — scans, wardrobe, outfits, messages, and images. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            // delete all backend data first
            const result = await deleteMyAccount();
            if (!result.success) {
              setDeletingAccount(false);
              showAlert('Error', 'Could not delete account data. Please try again.', [{ text: 'OK' }]);
              return;
            }
            // then delete the firebase auth account
            try {
              await deleteUser(auth.currentUser);
              // firebase sign out will happen automatically, no need to navigate
            } catch (err) {
              setDeletingAccount(false);
              // firebase requires recent login for this — prompt re-authentication
              showAlert(
                'Re-login Required',
                'For security, please log out and log back in, then try deleting your account again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  const handleDeleteImages = () => {
    showAlert(
      'Delete All My Images',
      'This will permanently delete all clothing images you have uploaded. Your scan history and wardrobe data will remain. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Images',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const result = await deleteAllMyImages();
            setDeleting(false);
            if (result.success) {
              showAlert(
                'Images Deleted',
                `Successfully deleted ${result.deletedFiles ?? 'all'} image file(s) from the server.`,
                [{ text: 'OK' }]
              );
            } else {
              showAlert('Error', 'Could not delete images. Please try again.', [{ text: 'OK' }]);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} accessibilityRole="none">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">Privacy & Data</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        <Section title="What data we store">
          <Text style={styles.body}>
            WearAware stores your account email and display name through Firebase Authentication.
            When you scan a garment, the image you take is uploaded to a server and stored alongside
            the scan result — this includes fibre composition, environmental grade, water usage and
            carbon footprint. Items you add to your wardrobe, outfits you create, and posts you
            make to the community feed are also stored on a private PostgreSQL database hosted on
            a self-managed Proxmox server in Ireland.
          </Text>
        </Section>

        <Section title="How your data is used">
          <Text style={styles.body}>
            Your scan images are used to generate visually relevant sustainable alternative
            suggestions through the CLIP model and Vertex AI search. Scan data is used to calculate
            your environmental impact summary and leaderboard ranking. Profile information is visible
            to other users only if your account is set to public.{'\n\n'}
            WearAware does not sell your data to third parties and does not use it for advertising.
          </Text>
        </Section>

        <Section title="GDPR compliance">
          <Text style={styles.body}>
            Under the General Data Protection Regulation (GDPR), you have the right to access,
            correct and delete your personal data. WearAware is designed to support these rights.
            You can delete your uploaded images or your entire account at any time using the
            buttons below.{'\n\n'}
            Image files are stored only on the private Proxmox server and are not shared with any
            third-party storage provider. Authentication is handled by Google Firebase, which is
            GDPR-compliant under Standard Contractual Clauses.
          </Text>
        </Section>

        <Section title="Third-party services">
          <Text style={styles.body}>
            WearAware uses the following external services:{'\n\n'}
            {'• '}Google Firebase — authentication and cloud messaging{'\n'}
            {'• '}Google Cloud Vision — clothing label OCR{'\n'}
            {'• '}Google Vertex AI — sustainable product search{'\n'}
            {'• '}Google Maps — charity shop finder{'\n'}
            {'• '}eBay API — second-hand product results{'\n\n'}
            Each of these services has its own privacy policy. No more data than necessary is
            shared with them to provide the feature.
          </Text>
        </Section>

        <Section title="Delete your image data">
          <Text style={styles.body}>
            You can permanently delete all clothing images you have uploaded to WearAware. This
            removes the image files from the server. Your scan records, grades, and wardrobe
            items will remain — only the photos are deleted.
          </Text>

          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
            onPress={handleDeleteImages}
            disabled={deleting || !user}
            accessibilityRole="button"
            accessibilityLabel="Delete all my uploaded images"
            accessibilityHint="Permanently removes all clothing photos you have uploaded"
          >
            <Ionicons name="trash-outline" size={18} color="#fff" style={{ marginRight: spacing.sm }} />
            <Text style={styles.deleteBtnText}>
              {deleting ? 'Deleting…' : 'Delete All My Images'}
            </Text>
          </TouchableOpacity>

          {!user && (
            <Text style={styles.hint}>Log in to use this feature.</Text>
          )}
        </Section>

        <Section title="Delete your account">
          <Text style={styles.body}>
            You can permanently delete your entire WearAware account. This removes your profile,
            all scans, wardrobe items, outfits, messages, social posts, and images from the
            server. This action is irreversible.
          </Text>

          <TouchableOpacity
            style={[styles.deleteBtn, deletingAccount && styles.deleteBtnDisabled]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount || !user}
            accessibilityRole="button"
            accessibilityLabel="Delete my account permanently"
            accessibilityHint="Permanently deletes your account and all associated data"
          >
            <Ionicons name="person-remove-outline" size={18} color="#fff" style={{ marginRight: spacing.sm }} />
            <Text style={styles.deleteBtnText}>
              {deletingAccount ? 'Deleting…' : 'Delete My Account'}
            </Text>
          </TouchableOpacity>

          {!user && (
            <Text style={styles.hint}>Log in to use this feature.</Text>
          )}
        </Section>

      </ScrollView>
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
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  deleteBtnText: {
    ...typography.button,
    color: '#fff',
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default DataPrivacyScreen;
