// author: caitriona mccann
// date: 26/11/2025
// firebase setup for authentication
// handles both email/password login and anonymous guest mode

import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// firebase configuration
const firebaseConfig = {
  apiKey: "GOOGLE_PLACES_API_KEY_REMOVED",
  authDomain: "wearaware-c2a46.firebaseapp.com",
  projectId: "wearaware-c2a46",
  storageBucket: "wearaware-c2a46.firebasestorage.app",
  messagingSenderId: "605048323002",
  appId: "1:605048323002:web:54dfe1688339aaa0157b83",
};

// initialize Firebase
const app = initializeApp(firebaseConfig);

// initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// initialize Storage
const storage = getStorage(app);

export { auth, storage };


