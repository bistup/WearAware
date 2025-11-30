// author: caitriona mccann
// date: 26/11/2025
// local storage for guest mode using asyncstorage
// saves scan history on the phone when you're not logged in

import AsyncStorage from '@react-native-async-storage/async-storage';

const SCANS_STORAGE_KEY = '@wearaware_scans';

// save scan to local phone storage
export const saveLocalScan = async (scanData) => {
  try {
    const scans = await getLocalHistory();
    const newScan = {
      ...scanData,
      id: Date.now().toString(), // use timestamp as id
      createdAt: new Date().toISOString(),
    };
    
    scans.unshift(newScan); // add to front of array
    
    await AsyncStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(scans));
    return newScan.id;
  } catch (error) {
    console.error('Error saving scan locally:', error);
    return null;
  }
};

// fetch all locally saved scans
export const getLocalHistory = async () => {
  try {
    const data = await AsyncStorage.getItem(SCANS_STORAGE_KEY);
    return data ? JSON.parse(data) : []; // return empty array if none
  } catch (error) {
    console.error('Error loading local history:', error);
    return [];
  }
};

// update existing local scan
export const updateLocalScan = async (scanId, updatedData) => {
  try {
    const scans = await getLocalHistory();
    const index = scans.findIndex((s) => s.id === scanId);
    
    if (index !== -1) {
      scans[index] = { ...scans[index], ...updatedData }; // merge updates
      await AsyncStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(scans));
      return true;
    }
    
    return false; // scan not found
  } catch (error) {
    console.error('Error updating local scan:', error);
    return false;
  }
};

// Delete local scan
export const deleteLocalScan = async (scanId) => {
  try {
    const scans = await getLocalHistory();
    const filtered = scans.filter((s) => s.id !== scanId);
    await AsyncStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting local scan:', error);
    return false;
  }
};

// Clear all local data
export const clearLocalStorage = async () => {
  try {
    await AsyncStorage.removeItem(SCANS_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing local storage:', error);
    return false;
  }
};


