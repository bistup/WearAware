// author: caitriona mccann
// date: 26/11/2025
// handles all the backend api calls to save and fetch scan data from postgres
// connects to the backend server running on port 3000

import { auth } from '../config/firebase';

// Use your computer's local IP address when running on phone
// Change this to your computer's IP address (check with 'ipconfig' in terminal)
const BACKEND_API_URL = 'http://192.168.1.15:3000/api';

// sync firebase user to postgres database
export const syncUserWithBackend = async (firebaseUser) => {
  // guest users don't get synced
  if (!firebaseUser || firebaseUser.isAnonymous) {
    return { success: false, error: 'Guest users are not synced' };
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/users/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to sync user with backend:', error);
    return { success: false, error: error.message };
  }
};

// fetch estimated weight for item type from backend
export const getItemWeight = async (itemType) => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/item-types/${itemType}`);
    const data = await response.json();
    
    if (data.success) {
      return data.itemType.estimated_weight_grams;
    }
    return 300; // default weight if not found
  } catch (error) {
    return 300; // default weight if backend unavailable
  }
};

// save scan to backend database
export const saveScanToBackend = async (scanData) => {
  const user = auth.currentUser;
  
  if (!user) {
    return { success: false, error: 'No user logged in' };
  }

  // guest users use local storage instead
  if (user.isAnonymous) {
    console.log('Guest user - not saving to backend');
    return { success: true, scanId: null, local: true };
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/scans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firebaseUid: user.uid,
        brand: scanData.brand,
        itemType: scanData.itemType,
        fibers: scanData.fibers,
        rawText: scanData.rawText,
        scanType: scanData.scanType || 'camera',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to save scan',
      };
    }

    console.log('Backend response:', JSON.stringify(data, null, 2));

    return {
      success: true,
      scanId: data.scanId,
      scan: data.scan,
    };
  } catch (error) {
    console.error('Backend unavailable:', error);
    return {
      success: false,
      error: 'Backend server not available',
    };
  }
};

// Fetch scan history (only for registered users)
export const fetchScanHistory = async () => {
  const user = auth.currentUser;
  
  if (!user || user.isAnonymous) {
    return {
      success: false,
      error: 'Guest users cannot access scan history',
      scans: [],
    };
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/scans/history/${user.uid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to fetch history',
        scans: [],
      };
    }

    return {
      success: true,
      scans: data.scans || [],
    };
  } catch (error) {
    return {
      success: false,
      error: 'Backend server not available',
      scans: [],
    };
  }
};

// Fetch single scan by ID
export const fetchScanById = async (scanId) => {
  const user = auth.currentUser;
  
  if (!user || !scanId) {
    return { success: false, error: 'Invalid request' };
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/scans/${scanId}?firebaseUid=${user.uid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to fetch scan',
      };
    }

    return {
      success: true,
      scan: data.scan,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch scan',
    };
  }
};

// Delete scan
export const deleteScan = async (scanId) => {
  const user = auth.currentUser;
  
  if (!user || user.isAnonymous) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/scans/${scanId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firebaseUid: user.uid,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to delete scan',
      };
    }

    return {
      success: true,
      message: 'Scan deleted',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to delete scan',
    };
  }
};

// Update scan
export const updateScan = async (scanId, updatedData) => {
  const user = auth.currentUser;
  
  if (!user || user.isAnonymous) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/scans/${scanId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firebaseUid: user.uid,
        brand: updatedData.brand,
        itemType: updatedData.itemType,
        fibers: updatedData.fibers,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to update scan',
      };
    }

    return {
      success: true,
      scan: data.scan,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to update scan',
    };
  }
};


