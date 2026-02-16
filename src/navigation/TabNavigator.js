// author: caitriona mccann
// date: 10/02/2026
// persistent bottom tab navigator - 5 main tabs
// eaa compliant: large touch targets, clear labels, screen reader support
// uses custom view-based icons (no emojis)

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, typography, spacing } from '../theme/theme';

// tab screens (entry points)
import HomeScreen from '../screens/main/HomeScreen';
import CameraScreen from '../screens/main/CameraScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import FeedScreen from '../screens/main/FeedScreen';
import ProfileScreen from '../screens/auth/ProfileScreen';

const Tab = createBottomTabNavigator();

// simple view-based tab icons - clean, minimal, no emoji
const HomeIcon = ({ color }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.homeRoof, { borderBottomColor: color }]} />
    <View style={[styles.homeBody, { backgroundColor: color }]} />
  </View>
);

const ScanIcon = ({ color }) => (
  <View style={styles.iconContainer}>
    <View style={styles.scanFrame}>
      <View style={[styles.scanCorner, { borderColor: color, top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5 }]} />
      <View style={[styles.scanCorner, { borderColor: color, top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5 }]} />
      <View style={[styles.scanCorner, { borderColor: color, bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5 }]} />
      <View style={[styles.scanCorner, { borderColor: color, bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5 }]} />
    </View>
  </View>
);

const HistoryIcon = ({ color }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.clockCircle, { borderColor: color }]} />
    <View style={[styles.clockHand1, { backgroundColor: color }]} />
    <View style={[styles.clockHand2, { backgroundColor: color }]} />
  </View>
);

const CommunityIcon = ({ color }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.personHead, { backgroundColor: color }]} />
    <View style={[styles.personBody, { backgroundColor: color }]} />
    <View style={[styles.personHead2, { backgroundColor: color }]} />
    <View style={[styles.personBody2, { backgroundColor: color }]} />
  </View>
);

const ProfileIcon = ({ color }) => (
  <View style={styles.iconContainer}>
    <View style={[styles.profileHead, { backgroundColor: color }]} />
    <View style={[styles.profileBody, { backgroundColor: color }]} />
  </View>
);

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
          height: 64,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          minHeight: 48,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color }) => <ScanIcon color={color} />,
          tabBarAccessibilityLabel: 'Scan a clothing label',
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color }) => <HistoryIcon color={color} />,
          tabBarAccessibilityLabel: 'View scan history',
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Community',
          tabBarIcon: ({ color }) => <CommunityIcon color={color} />,
          tabBarAccessibilityLabel: 'Community feed',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
          tabBarAccessibilityLabel: 'Your profile',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  // home icon
  homeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  homeBody: {
    width: 16,
    height: 10,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    marginTop: -1,
  },
  // scan icon
  scanFrame: {
    width: 22,
    height: 22,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 1,
  },
  // history icon (clock)
  clockCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
  },
  clockHand1: {
    position: 'absolute',
    width: 2,
    height: 7,
    borderRadius: 1,
    top: 4,
    left: 11,
  },
  clockHand2: {
    position: 'absolute',
    width: 5,
    height: 2,
    borderRadius: 1,
    top: 11,
    left: 12,
  },
  // community icon (two people)
  personHead: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    top: 1,
    left: 5,
  },
  personBody: {
    position: 'absolute',
    width: 12,
    height: 7,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    bottom: 1,
    left: 2,
  },
  personHead2: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    top: 3,
    right: 2,
  },
  personBody2: {
    position: 'absolute',
    width: 10,
    height: 6,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    bottom: 0,
    right: 0,
    opacity: 0.6,
  },
  // profile icon
  profileHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 1,
  },
  profileBody: {
    width: 14,
    height: 8,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
});

export default TabNavigator;
