// author: caitriona mccann
// date: 10/02/2026
// last updated: 04/03/2026
// persistent bottom tab navigator - 5 main tabs
// eaa compliant: large touch targets, clear labels, screen reader support
// uses ionicons for clean, consistent icons

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../theme/theme';

// tab screens (entry points)
import HomeScreen from '../screens/main/HomeScreen';
import CameraScreen from '../screens/main/CameraScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import FeedScreen from '../screens/main/FeedScreen';
import MarketplaceScreen from '../screens/main/MarketplaceScreen';
import ProfileScreen from '../screens/auth/ProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Camera: { focused: 'scan', unfocused: 'scan-outline' },
  History: { focused: 'time', unfocused: 'time-outline' },
  Feed: { focused: 'people', unfocused: 'people-outline' },
  Marketplace: { focused: 'storefront', unfocused: 'storefront-outline' },
  Profile: { focused: 'person', unfocused: 'person-outline' },
};

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const baseTabBarHeight = Platform.OS === 'ios' ? 56 : 54;
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 6);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarIcon: ({ color, focused, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.unfocused;
          return <Ionicons name={iconName} size={22} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: baseTabBarHeight + bottomInset,
          paddingTop: 6,
          paddingBottom: bottomInset,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 1,
        },
        tabBarItemStyle: {
          minHeight: 44,
          paddingHorizontal: 0,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarAccessibilityLabel: 'Scan a clothing label',
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarAccessibilityLabel: 'View scan history',
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Feed',
          tabBarAccessibilityLabel: 'Community feed',
        }}
      />
      <Tab.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{
          tabBarLabel: 'Market',
          tabBarAccessibilityLabel: 'Marketplace',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'Your profile',
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
