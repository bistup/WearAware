// author: caitriona mccann
// date: 19/02/2026
// web search service for finding sustainable product alternatives
// uses vertex ai grounded search (gemini) to find real products from the web

const fetch = require('node-fetch');
const vertexAi = require('./vertexAiService');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5000';

// curated sustainable fashion sites for focused search
const SUSTAINABLE_SITES = [
  'patagonia.com',
  'everlane.com',
  'tentree.com',
  'reformation.com',
  'pangaia.com',
  'eileen-fisher.com',
  'pfrankp.com',
  'organicbasics.com',
  'kotn.com',
  'outerknown.com',
  'thought-clothing.com',
  'armedangels.com',
  'nudie-jeans.com',
  'peopletree.co.uk',
  'wearethought.com',
];

/**
 * Search the web for sustainable alternatives to a scanned garment
 * @param {string} itemType - e.g. "T-Shirt", "Jeans", "Jacket"
 * @param {string} primaryFiber - e.g. "Cotton", "Polyester"
 * @param {object} options - search options
 * @returns {Promise<{success: boolean, results: Array, error?: string}>}
 */
async function searchAlternatives(itemType, primaryFiber, options = {}) {
  if (!GOOGLE_API_KEY) {
    return {
      success: false,
      error: 'Google API key not configured',
      results: [],
    };
  }

  const { limit = 8, sustainableOnly = true, imageUrl = null, gender = null } = options;

  try {
    // if we have an image, ask CLIP to describe it for visual-aware search
    let imageDescription = null;
    if (imageUrl) {
      imageDescription = await describeGarmentImage(imageUrl);
      console.log('CLIP image description:', imageDescription);
    }

    // build a search query targeting sustainable alternatives
    const fiberTerm = getSustainableFiberAlternative(primaryFiber);
    const query = buildSearchQuery(itemType, fiberTerm, sustainableOnly, imageDescription, gender);

    console.log('Web search query:', query);

    // use vertex ai grounded search
    const searchResult = await vertexAi.groundedSearch(query, limit);

    return {
      success: searchResult.success,
      results: searchResult.results,
      query,
      totalResults: searchResult.totalResults || searchResult.results.length,
      error: searchResult.error,
    };
  } catch (error) {
    console.error('Web search error:', error.message);
    return {
      success: false,
      error: error.message,
      results: [],
    };
  }
}

/**
 * Ask the CLIP ML service to describe a garment image
 * Returns color, pattern, style, garment_type
 */
async function describeGarmentImage(imageUrl) {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/describe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
      timeout: 15000,
    });

    if (!response.ok) {
      console.warn('ML describe endpoint returned', response.status);
      return null;
    }

    const data = await response.json();
    if (data.success) {
      return {
        color: data.color,
        pattern: data.pattern,
        style: data.style,
        garmentType: data.garment_type,
        description: data.description,
      };
    }
    return null;
  } catch (err) {
    console.warn('Failed to describe garment image:', err.message);
    return null;
  }
}

/**
 * Build an effective search query for sustainable fashion
 */
function buildSearchQuery(itemType, fiberTerm, sustainableOnly, imageDescription = null, gender = null) {
  // keep queries simple for vertex ai discovery engine
  // the data store already only contains sustainable brand sites
  const parts = [];

  // prepend gender for more relevant results (e.g. "womens t-shirt")
  if (gender) {
    parts.push(gender);
  }

  // use CLIP-detected visual attributes if available
  if (imageDescription) {
    if (imageDescription.color) {
      parts.push(imageDescription.color);
    }
    if (imageDescription.pattern && imageDescription.pattern !== 'solid color') {
      parts.push(imageDescription.pattern);
    }
    if (imageDescription.garmentType) {
      parts.push(imageDescription.garmentType);
    } else if (itemType && itemType !== 'Garment') {
      parts.push(itemType);
    }
  } else {
    if (itemType && itemType !== 'Garment') {
      parts.push(itemType);
    }
  }

  if (fiberTerm) {
    parts.push(fiberTerm);
  }

  return parts.join(' ') || 'clothing';
}

/**
 * Suggest a more sustainable fiber alternative for the search
 * e.g. if user scanned "Polyester", search for "organic cotton" or "Tencel" alternatives
 */
function getSustainableFiberAlternative(fiber) {
  if (!fiber) return '';

  const alternatives = {
    Polyester: 'organic cotton',
    Nylon: 'Tencel',
    Acrylic: 'merino wool',
    Spandex: 'organic cotton stretch',
    Elastane: 'organic cotton stretch',
    Cotton: 'organic cotton',
    Rayon: 'Tencel lyocell',
    Viscose: 'Tencel lyocell',
    Bamboo: 'linen',
  };

  return alternatives[fiber] || fiber;
}

/**
 * Check if web search is configured
 * @returns {boolean}
 */
function isConfigured() {
  const vertexAi = require('./vertexAiService');
  return vertexAi.isConfigured();
}

module.exports = {
  searchAlternatives,
  describeGarmentImage,
  isConfigured,
};
