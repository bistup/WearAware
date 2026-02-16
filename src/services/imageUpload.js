/**
 * Image Upload Service
 * Handles uploading scan images to Firebase Storage
 * Author: Caitriona McCann
 */

import { storage, auth } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Upload scan image to Firebase Storage
 * @param {string} localUri - Local file URI from camera/gallery
 * @param {string} scanId - Scan ID for organizing files
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadScanImage(localUri, scanId) {
  try {
    const user = auth.currentUser;

    if (!user || user.isAnonymous) {
      return {
        success: false,
        error: 'Must be logged in to upload images',
      };
    }

    // Compress image before upload (max 800px width, 80% quality)
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 800 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Convert to blob for upload
    const response = await fetch(manipulatedImage.uri);
    const blob = await response.blob();

    // Create storage reference
    const filename = `scans/${user.uid}/${scanId || Date.now()}.jpg`;
    const storageRef = ref(storage, filename);

    // Upload file
    console.log('Uploading image to Firebase Storage:', filename);
    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    console.log('Image uploaded successfully:', downloadURL);

    return {
      success: true,
      url: downloadURL,
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Upload thumbnail version of image (smaller, for feeds/lists)
 * @param {string} localUri - Local file URI
 * @param {string} scanId - Scan ID
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadThumbnail(localUri, scanId) {
  try {
    const user = auth.currentUser;

    if (!user || user.isAnonymous) {
      return { success: false, error: 'Must be logged in' };
    }

    // Create thumbnail (300px width, 70% quality)
    const thumbnail = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 300 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    const response = await fetch(thumbnail.uri);
    const blob = await response.blob();

    const filename = `thumbnails/${user.uid}/${scanId || Date.now()}.jpg`;
    const storageRef = ref(storage, filename);

    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    return {
      success: true,
      url: downloadURL,
    };
  } catch (error) {
    console.error('Error uploading thumbnail:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Delete image from Firebase Storage
 * @param {string} imageUrl - Full Firebase Storage URL
 * @returns {Promise<boolean>}
 */
export async function deleteImage(imageUrl) {
  try {
    if (!imageUrl || !imageUrl.includes('firebase')) {
      return false;
    }

    const storageRef = ref(storage, imageUrl);
    await deleteObject(storageRef);

    console.log('Image deleted:', imageUrl);
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}

/**
 * Upload both full image and thumbnail
 * @param {string} localUri - Local file URI
 * @param {string} scanId - Scan ID
 * @returns {Promise<{success: boolean, imageUrl?: string, thumbnailUrl?: string, error?: string}>}
 */
export async function uploadScanImages(localUri, scanId) {
  try {
    // Upload both in parallel
    const [fullResult, thumbResult] = await Promise.all([
      uploadScanImage(localUri, scanId),
      uploadThumbnail(localUri, scanId),
    ]);

    if (!fullResult.success) {
      return fullResult;
    }

    return {
      success: true,
      imageUrl: fullResult.url,
      thumbnailUrl: thumbResult.success ? thumbResult.url : fullResult.url,
    };
  } catch (error) {
    console.error('Error uploading scan images:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
