/**
 * ML Service Client
 * Communicates with Python Flask ML service for CLIP embeddings
 * Author: Caitriona McCann
 */

const fetch = require('node-fetch');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

/**
 * Extract CLIP embedding from image URL
 * @param {string} imageUrl - URL of image to process
 * @returns {Promise<{success: boolean, embedding: number[], error?: string}>}
 */
async function extractEmbedding(imageUrl) {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/extract-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_url: imageUrl }),
      timeout: 30000, // 30 second timeout
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ML service error: ${error}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to extract embedding');
    }

    return {
      success: true,
      embedding: data.embedding,
      dimension: data.dimension,
    };
  } catch (error) {
    console.error('Error calling ML service:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Extract embeddings for multiple images in batch
 * @param {string[]} imageUrls - Array of image URLs
 * @returns {Promise<{success: boolean, embeddings: number[][], error?: string}>}
 */
async function extractEmbeddingBatch(imageUrls) {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/extract-embedding-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_urls: imageUrls }),
      timeout: 60000, // 60 second timeout for batch
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ML service error: ${error}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to extract embeddings');
    }

    return {
      success: true,
      embeddings: data.embeddings,
      count: data.count,
    };
  } catch (error) {
    console.error('Error calling ML service for batch:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Calculate cosine similarity between two embeddings
 * Embeddings should already be normalized (CLIP outputs are normalized)
 * @param {number[]} embedding1
 * @param {number[]} embedding2
 * @returns {number} Similarity score 0-1
 */
function cosineSimilarity(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have same dimension');
  }

  let dotProduct = 0;
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
  }

  // CLIP embeddings are already normalized, so dot product = cosine similarity
  return dotProduct;
}

/**
 * Find most similar items from a database result set
 * @param {number[]} queryEmbedding - Embedding to compare against
 * @param {Array} items - Array of items with image_embedding property
 * @param {number} limit - Number of results to return
 * @returns {Array} Items sorted by similarity with similarity_score added
 */
function findMostSimilar(queryEmbedding, items, limit = 10) {
  // Calculate similarity for each item
  const scored = items
    .filter((item) => item.image_embedding) // Only items with embeddings
    .map((item) => {
      const similarity = cosineSimilarity(queryEmbedding, item.image_embedding);
      return {
        ...item,
        similarity_score: similarity,
      };
    });

  // Sort by similarity (highest first) and limit
  scored.sort((a, b) => b.similarity_score - a.similarity_score);

  return scored.slice(0, limit);
}

/**
 * Check if ML service is healthy and running
 * @returns {Promise<boolean>}
 */
async function checkHealth() {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      timeout: 5000,
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    console.error('ML service health check failed:', error.message);
    return false;
  }
}

module.exports = {
  extractEmbedding,
  extractEmbeddingBatch,
  cosineSimilarity,
  findMostSimilar,
  checkHealth,
};
