// author: caitriona mccann
// date: 10/12/2025
// hybrid OCR service that uses Google Vision API when online, graceful fallback when offline

import NetInfo from '@react-native-community/netinfo';
import { processImageWithVision } from './visionApi';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Process image with best available OCR method
 * - Online: Uses Google Vision API (accurate and reliable)
 * - Offline: Returns error prompting user for manual input
 * 
 * @param {string} imageUri - Local file URI of the image
 * @returns {Promise<{success: boolean, data?: object, error?: string, method?: string}>}
 */
export const processImageHybrid = async (imageUri) => {
  try {
    // check internet connectivity
    const netState = await NetInfo.fetch();
    const isConnected = netState.isConnected && netState.isInternetReachable !== false;

    console.log(`OCR mode: ${isConnected ? 'Online (Vision API)' : 'Offline (Manual input required)'}`);

    if (!isConnected) {
      return {
        success: false,
        error: 'No internet connection. Please connect to WiFi or use manual input.',
        method: 'offline',
      };
    }

    // use Google Vision API
    try {
      // read image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

      const visionResult = await processImageWithVision(base64);
      
      if (visionResult.success) {
        return {
          ...visionResult,
          method: 'vision-api',
        };
      }
      
      return {
        success: false,
        error: visionResult.error || 'Failed to process image',
        method: 'vision-api-failed',
      };
    } catch (visionError) {
      console.log('Vision API error:', visionError.message);
      return {
        success: false,
        error: 'Failed to process image. Please try again or use manual input.',
        method: 'error',
      };
    }
  } catch (error) {
    console.error('Hybrid OCR error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process image',
      method: 'error',
    };
  }
};

/**
 * Check if device has internet connectivity
 * @returns {Promise<boolean>}
 */
export const checkConnectivity = async () => {
  try {
    const netState = await NetInfo.fetch();
    return netState.isConnected && netState.isInternetReachable !== false;
  } catch (error) {
    console.error('Connectivity check error:', error);
    return false;
  }
};
