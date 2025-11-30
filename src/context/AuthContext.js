// author: caitriona mccann
// date: 26/11/2025
// handles all the login stuff - firebase authentication, guest mode, keeping track of who's logged in
// works with both email/password and anonymous users

import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { syncUserWithBackend } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsGuest(currentUser?.isAnonymous || false);
      
      // sync logged-in users with backend
      if (currentUser && !currentUser.isAnonymous) {
        await syncUserWithBackend(currentUser);
      }
      
      setLoading(false);
    });

    return unsubscribe; // cleanup on unmount
  }, []);

  // create new account with email/password
  const register = async (email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // sign in with email/password
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // sign in anonymously as guest
  const loginAsGuest = async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      setIsGuest(true);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // sign out current user
  const logout = async () => {
    try {
      await signOut(auth);
      setIsGuest(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    loading,
    isGuest,
    register,
    login,
    loginAsGuest,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};


