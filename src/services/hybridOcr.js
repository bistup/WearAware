// author: caitriona mccann
// date: 10/12/2025
// last updated: 14/04/2026
// hybrid OCR orchestration layer - selects OCR method based on connectivity
//
// originally planned as a two-path strategy:
//   online  → Google Cloud Vision API (accurate, handles skewed/noisy label text)
//   offline → would prompt for manual input
//
// current behaviour: vision api only (no offline ocr fallback).
// if offline, processImageHybrid() returns an error prompting the user to
// use ManualInputScreen instead. if vision api fails, same error is returned.
//
// called from: CameraScreen.js after the user captures a label photo

import NetInfo from '@react-native-community/netinfo';
import { processImageWithVision } from './visionApi';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Process a captured label image using the best available OCR method.
 * Checks internet connectivity first. If online, reads the image as base64
 * and calls the Google Vision API. If offline, returns an error directing
 * the user to ManualInputScreen.
 *
 * @param {string} imageUri - local file URI from expo-camera, e.g. "file:///..."
 * @returns {Promise<{success: boolean, data?: object, error?: string, method?: string}>}
 *   - method: 'vision-api' on success, 'offline'/'vision-api-failed'/'error' on failure
 */
export const processImageHybrid = async (imageUri) => {
  try {
    // check both isConnected and isInternetReachable — the latter can be false on captive portals
    const netState = await NetInfo.fetch();
    const isConnected = netState.isConnected && netState.isInternetReachable !== false;

    console.log(`OCR mode: ${isConnected ? 'Online (Vision API)' : 'Offline (Manual input required)'}`);

    // no internet — can't call Vision API; direct user to manual input
    if (!isConnected) {
      return {
        success: false,
        error: 'No internet connection. Please connect to WiFi or use manual input.',
        method: 'offline',
      };
    }

    // online — use Google Cloud Vision API
    try {
      // read the captured image file as a base64 string
      // expo-file-system/legacy is used for Expo Go compatibility
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

      // send the base64 image to Vision API for OCR
      const visionResult = await processImageWithVision(base64);

      if (visionResult.success) {
        // tag the result with the method that produced it, for debugging
        return {
          ...visionResult,
          method: 'vision-api',
        };
      }

      // Vision API returned success:false — no text detected or API error
      return {
        success: false,
        error: visionResult.error || 'Failed to process image',
        method: 'vision-api-failed',
      };
    } catch (visionError) {
      // network error or unexpected Vision API failure
      console.log('Vision API error:', visionError.message);
      return {
        success: false,
        error: 'Failed to process image. Please try again or use manual input.',
        method: 'error',
      };
    }
  } catch (error) {
    // NetInfo.fetch() threw — treat as connectivity failure
    console.error('Hybrid OCR error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process image',
      method: 'error',
    };
  }
};

/**
 * Check whether the device currently has an internet connection.
 * Used by CameraScreen to gate the scan button before attempting OCR.
 *
 * @returns {Promise<boolean>} true if connected and internet is reachable
 */
export const checkConnectivity = async () => {
  try {
    const netState = await NetInfo.fetch();
    // both checks needed: isConnected covers Wi-Fi/cell, isInternetReachable covers captive portals
    return netState.isConnected && netState.isInternetReachable !== false;
  } catch (error) {
    console.error('Connectivity check error:', error);
    // assume offline on error — conservative approach to avoid a broken Vision API call
    return false;
  }
};
