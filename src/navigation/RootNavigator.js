// author: caitriona mccann
// date: 26/11/2025
// root navigator - switches between auth and main screens based on login state

import React, { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { AlertProvider } from '../context/AlertContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { setupNotificationListeners } from '../services/notifications';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import MainStack from './MainStack';
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator();

const NotificationSetup = () => {
  const navigation = useNavigation();
  const navRef = useRef({ current: navigation });
  navRef.current = navigation;

  useEffect(() => {
    return setupNotificationListeners(navRef);
  }, []);

  return null;
};

const RootNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AlertProvider>
      {user && <NotificationSetup />}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainStack} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </AlertProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default RootNavigator;


