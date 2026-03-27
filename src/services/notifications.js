// push notification service
// handles registration, permissions, and tap-to-navigate behavior

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken } from './api';

// show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let pushToken = null;

/**
 * Register for push notifications and send token to backend
 */
export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    pushToken = tokenData.data;

    // set up Android notification channel
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // send token to backend
    await registerPushToken(pushToken, Platform.OS);

    return pushToken;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Unregister push token on logout
 */
export async function unregisterPushNotifications() {
  try {
    if (pushToken) {
      await unregisterPushToken(pushToken);
      pushToken = null;
    }
  } catch (error) {
    console.error('Error unregistering push notifications:', error);
  }
}

/**
 * Set up notification response listener for tap-to-navigate
 * @param {object} navigationRef - React Navigation ref
 * @returns {function} cleanup function
 */
export function setupNotificationListeners(navigationRef) {
  // handle notification tap
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (!navigationRef?.current) return;

    if (data.type === 'message' && data.conversationId) {
      navigationRef.current.navigate('Chat', {
        conversationId: data.conversationId,
      });
    } else if (data.type === 'trade' && data.tradeId) {
      navigationRef.current.navigate('Trade', {
        tradeRequestId: data.tradeId,
        conversationId: data.conversationId,
      });
    }
  });

  return () => {
    responseSubscription.remove();
  };
}
