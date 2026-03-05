/**
 * Image Upload Service
 * Uploads scan images to the backend server (self-hosted, no Firebase Storage)
 * Privacy: EXIF/GPS stripped server-side, UUID filenames, user-scoped folders
 * Author: Caitriona McCann
 */

import { auth } from '../config/firebase';
import * as ImageManipulator from 'expo-image-manipulator';

// backend URL (same LXC as the API)
const UPLOAD_URL = 'http://YOUR_SERVER_IP:3000/api/uploads/image';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getAuthHeader(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return {};

  try {
    const idToken = await user.getIdToken(forceRefresh);
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  } catch (error) {
    console.warn('Failed to get auth token for image upload:', error?.message || error);
    return {};
  }
}

/**
 * Upload scan image to backend server
 * Server handles: compression, thumbnail generation, EXIF stripping, UUID naming
 * @param {string} localUri - Local file URI from camera/gallery
 * @param {string} scanId - Scan ID (used for reference only, server generates UUID filename)
 * @returns {Promise<{success: boolean, imageUrl?: string, thumbnailUrl?: string, error?: string}>}
 */
export async function uploadScanImages(localUri, scanId) {
  try {
    const user = auth.currentUser;

    if (!user || user.isAnonymous) {
      return {
        success: false,
        error: 'Must be logged in to upload images',
      };
    }

    // light client-side resize to reduce upload size (max 1200px before sending)
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1200 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );

    const fileName = `${scanId || Date.now()}.jpg`;

    const buildFormData = () => {
      const formData = new FormData();
      formData.append('image', {
        uri: manipulatedImage.uri,
        type: 'image/jpeg',
        name: fileName,
      });
      formData.append('firebaseUid', user.uid);
      return formData;
    };

    console.log('Uploading image to backend server...');

    let response;
    let lastNetworkError = null;

    // Retry transient Android network errors with a fresh multipart body each attempt.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const authHeader = await getAuthHeader(attempt > 1);
        response = await fetch(UPLOAD_URL, {
          method: 'POST',
          body: buildFormData(),
          headers: {
            ...authHeader,
            Accept: 'application/json',
            Connection: 'close',
          },
          // don't set Content-Type header — fetch sets it with the boundary for multipart
        });

        if (response.status !== 401) {
          break;
        }

        // 401 can happen with stale tokens; refresh and retry next iteration.
      } catch (networkError) {
        lastNetworkError = networkError;
      }

      if (attempt < 3) {
        await sleep(250 * attempt);
      }
    }

    if (!response) {
      throw lastNetworkError || new Error('Network request failed');
    }

    const raw = await response.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw?.slice(0, 200) || 'Upload failed' };
    }

    if (!response.ok || !data.success) {
      console.error('Upload failed:', data.error);
      return {
        success: false,
        error: data.error || `Upload failed (${response.status})`,
      };
    }

    console.log('Image uploaded successfully:', data.imageUrl);

    return {
      success: true,
      imageUrl: data.imageUrl,
      thumbnailUrl: data.thumbnailUrl,
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
 * Upload just the full-size image (legacy compat)
 */
export async function uploadScanImage(localUri, scanId) {
  const result = await uploadScanImages(localUri, scanId);
  return {
    success: result.success,
    url: result.imageUrl,
    error: result.error,
  };
}

/**
 * Upload just a thumbnail (legacy compat - server generates both anyway)
 */
export async function uploadThumbnail(localUri, scanId) {
  const result = await uploadScanImages(localUri, scanId);
  return {
    success: result.success,
    url: result.thumbnailUrl,
    error: result.error,
  };
}

/**
 * Delete image from server
 * @param {string} imageUrl - Full URL of the image
 * @returns {Promise<boolean>}
 */
export async function deleteImage(imageUrl) {
  try {
    if (!imageUrl || !imageUrl.includes('/uploads/')) {
      return false;
    }

    const user = auth.currentUser;
    if (!user) return false;

    const authHeader = await getAuthHeader();

    // extract /userHash/filename from URL
    const urlParts = imageUrl.split('/uploads/scans/');
    if (urlParts.length < 2) return false;

    const pathPart = urlParts[1]; // "userHash/filename.jpg"

    const response = await fetch(
      `http://YOUR_SERVER_IP:3000/api/uploads/image/${pathPart}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ firebaseUid: user.uid }),
      }
    );

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}

/**
 * GDPR: Delete all images for the current user
 * @returns {Promise<{success: boolean, deletedFiles?: number}>}
 */
export async function deleteAllMyImages() {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false };

    const authHeader = await getAuthHeader();

    const response = await fetch('http://YOUR_SERVER_IP:3000/api/uploads/my-data', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ firebaseUid: user.uid }),
    });

    return await response.json();
  } catch (error) {
    console.error('Error deleting all images:', error);
    return { success: false, error: error.message };
  }
}
