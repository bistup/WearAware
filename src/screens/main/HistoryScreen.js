// author: caitriona mccann
// date: 27/11/2025
// shows all your previous scans with their grades
// loads from backend if logged in, otherwise uses local storage for guest mode

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/Card';
import Button from '../../components/Button';
import GradeIndicator from '../../components/GradeIndicator';
import { colors, typography, spacing, borderRadius } from '../../theme/theme';
import { fetchScanHistory, deleteScan } from '../../services/api';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';

const HistoryScreen = () => {
  const navigation = useNavigation();
  const { isGuest, user } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isGuest) {
      loadHistory();
    } else {
      setLoading(false);
    }
  }, [isGuest]);

  const loadHistory = async () => {
    setLoading(true);
    
    // Only load for registered users
    const result = await fetchScanHistory();
    if (result.success) {
      setScans(result.scans);
    }
    
    setLoading(false);
  };

  const handleDeleteScan = (scanId, brand) => {
    Alert.alert(
      'Delete Scan',
      `Are you sure you want to delete the scan for ${brand || 'this item'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteScan(scanId);
            if (result.success) {
              setScans(scans.filter(scan => scan.id !== scanId));
            } else {
              Alert.alert('Error', result.error || 'Failed to delete scan');
            }
          },
        },
      ]
    );
  };

  const renderScanItem = ({ item }) => (
    <Card style={styles.scanCard}>
      <TouchableOpacity
        onPress={() => navigation.navigate('ScanResult', { 
          scanData: item,
          scanId: item.id 
        })}
        activeOpacity={0.7}
        style={styles.scanContent}
      >
        <View style={styles.scanHeader}>
          <View style={styles.scanInfo}>
            <Text style={styles.brand}>{item.brand || 'Unknown Brand'}</Text>
            <Text style={styles.itemType}>{item.itemType || 'Garment'}</Text>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <GradeIndicator grade={item.grade || 'C'} size="small" />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleDeleteScan(item.id, item.brand)}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </Card>
  );

  const handleSignUp = async () => {
    // Logout guest user, which will show auth screens
    await signOut(auth);
  };

  const styles = getStyles(colors, typography, spacing);

  const renderGuestPrompt = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>History Not Available</Text>
      <Text style={styles.emptySubtext}>
        Sign up for an account to save and view your scan history across devices
      </Text>
      <Button
        title="Sign Up"
        onPress={handleSignUp}
        style={styles.signUpButton}
      />
      <Button
        title="Go Back"
        onPress={() => navigation.goBack()}
        variant="secondary"
        style={styles.backButton}
      />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No scans yet</Text>
      <Text style={styles.emptySubtext}>
        Start scanning clothing labels to see your history
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scan History</Text>
      </View>

      {isGuest ? (
        renderGuestPrompt()
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={scans}
          renderItem={renderScanItem}
          keyExtractor={(item, index) => item.id || index.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  );
};

const getStyles = (colors, typography, spacing) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    ...typography.h1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  scanCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  scanContent: {
    flex: 1,
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#E74C3C',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderRadius: 4,
  },
  deleteText: {
    color: colors.surface,
    ...typography.bodySmall,
    fontWeight: '600',
  },
  scanInfo: {
    flex: 1,
  },
  brand: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  itemType: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  date: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
  },
  emptyText: {
    ...typography.h3,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  signUpButton: {
    width: '100%',
    marginBottom: spacing.md,
  },
  backButton: {
    width: '100%',
  },
});

export default HistoryScreen;


