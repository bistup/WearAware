// author: caitriona mccann
// date: 19/03/2026
// global alert context - replaces native Alert.alert with a styled bottom sheet
// usage: const { showAlert } = useAlert();
//        showAlert('Title', 'Message', [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', onPress: () => {} }])

import React, { createContext, useContext, useState, useCallback } from 'react';
import AppAlert from '../components/AppAlert';

const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
  const [config, setConfig] = useState(null);

  // matches Alert.alert(title, message?, buttons?) signature exactly
  const showAlert = useCallback((title, message, buttons) => {
    // support Alert.alert('Title', [...buttons]) with no message
    if (Array.isArray(message)) {
      setConfig({ title, message: null, buttons: message });
    } else {
      setConfig({
        title: title || '',
        message: message || null,
        buttons: buttons || [{ text: 'OK' }],
      });
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setConfig(null);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <AppAlert
        visible={!!config}
        title={config?.title}
        message={config?.message}
        buttons={config?.buttons || []}
        onDismiss={handleDismiss}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
};
