// author: caitriona mccann
// date: 19/02/2026
// web search service for finding sustainable product alternatives
// uses vertex ai discovery engine (grounded search) to find products from
// a curated set of sustainable fashion brand sites
//
// search flow:
//   1. if a scan image is available, call the CLIP ml-service /describe endpoint
//      to get visual attributes (color, pattern, garment type, style)
//   2. build a search query using:
//        - garment type (from scan or CLIP)
//        - visual attributes if available
//        - a sustainable fiber substitute (e.g. polyester → organic cotton)
//        - optional gender prefix (from scan data)
//   3. call vertexAiService.groundedSearch() which hits the discovery engine
//      data store pre-indexed with the SUSTAINABLE_SITES below
//   4. filter out results with no image or that are clearly non-product pages
//
// note: SUSTAINABLE_SITES is for reference / documentation only.
// the actual filtering happens in the vertex ai data store configuration in GCP,
// not in this code. these are the sites that were indexed.

const fetch = require('node-fetch');
const vertexAi = require('./vertexAiService');

// GOOGLE_API_KEY is checked by isConfigured() — not used directly here,
// but signals whether the search pipeline is properly set up
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// ML_SERVICE_URL points to the Python Flask CLIP service running on the Proxmox server
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5000';

// sustainable fashion brand sites indexed in the vertex ai discovery engine data store.
// this list is documentation only — changing it here has no effect on search results.
// to change which sites are searched, update the data store configuration in GCP Console.
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
 * Search for sustainable clothing alternatives for a scanned garment.
 * If a garment photo URL is provided, the CLIP ML service is asked to describe
 * it visually (colour, pattern, garment type) to produce a richer search query.
 *
 * @param {string} itemType - garment type from scan, e.g. "T-Shirt", "Jeans"
 * @param {string} primaryFiber - dominant fiber from scan, e.g. "Polyester", "Cotton"
 * @param {object} [options={}] - additional search options
 * @param {number} [options.limit=8] - max results to return
 * @param {boolean} [options.sustainableOnly=true] - reserved for future use
 * @param {string|null} [options.imageUrl=null] - garment photo URL to describe with CLIP
 * @param {string|null} [options.gender=null] - "mens" or "womens" for gender-aware queries
 * @returns {Promise<{success: boolean, results: Array, query?: string, error?: string}>}
 */
async function searchAlternatives(itemType, primaryFiber, options = {}) {
  // check that google API key is configured before attempting the search
  if (!GOOGLE_API_KEY) {
    return {
      success: false,
      error: 'Google API key not configured',
      results: [],
    };
  }

  // destructure options with sensible defaults
  const { limit = 8, sustainableOnly = true, imageUrl = null, gender = null } = options;

  try {
    // step 1: if a garment photo was taken, ask CLIP to describe it visually
    // this adds colour, pattern, and garment type to the query for better matching
    let imageDescription = null;
    if (imageUrl) {
      imageDescription = await describeGarmentImage(imageUrl);
      console.log('CLIP image description:', imageDescription);
    }

    // step 2: convert the scanned fiber to a more sustainable search term
    // e.g. "Polyester" → "organic cotton" so we surface better alternatives
    const fiberTerm = getSustainableFiberAlternative(primaryFiber);

    // step 3: build the search query string combining all available signals
    const query = buildSearchQuery(itemType, fiberTerm, sustainableOnly, imageDescription, gender);

    console.log('Web search query:', query);

    // step 4: request more results than needed (limit * 2) so we can filter poor ones
    const searchResult = await vertexAi.groundedSearch(query, limit * 2);

    // step 5: filter out results that lack images or look like non-product pages
    const filtered = (searchResult.results || []).filter(r => {
      // skip results with no image — they make poor product cards
      if (!r.imageUrl) return false;
      // skip obvious non-product URL patterns (blog posts, about pages, etc.)
      const url = (r.link || '').toLowerCase();
      if (url.match(/\/(about|blog|journal|story|sustainability|careers|press|contact|faq)\/?$/)) return false;
      return true;
    }).slice(0, limit);  // trim to the requested limit after filtering

    return {
      success: searchResult.success,
      results: filtered,
      query,                          // included so the route can cache by query
      totalResults: filtered.length,
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
 * Ask the CLIP ML service to visually describe a garment image.
 * Calls the /describe endpoint which uses zero-shot classification to identify
 * the garment's colour, pattern, style, and garment type.
 * Returns null on any failure so the caller can fall back to a text-only query.
 *
 * @param {string} imageUrl - publicly accessible URL of the garment photo
 * @returns {Promise<{color, pattern, style, garmentType, description}|null>}
 */
async function describeGarmentImage(imageUrl) {
  try {
    // POST the image URL to the CLIP service /describe endpoint
    const response = await fetch(`${ML_SERVICE_URL}/describe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
      timeout: 15000,  // 15s timeout — CLIP on CPU can be slow for the first request
    });

    // non-2xx means the ML service returned an error
    if (!response.ok) {
      console.warn('ML describe endpoint returned', response.status);
      return null;  // gracefully return null so the search continues without visual data
    }

    const data = await response.json();
    if (data.success) {
      // map from the snake_case ML response to camelCase for JS consistency
      return {
        color: data.color,
        pattern: data.pattern,
        style: data.style,
        garmentType: data.garment_type,  // CLIP returns snake_case field names
        description: data.description,
      };
    }
    // CLIP returned success:false (e.g. low confidence on all labels)
    return null;
  } catch (err) {
    // network errors or JSON parse errors — fail silently
    console.warn('Failed to describe garment image:', err.message);
    return null;
  }
}

/**
 * Build a text search query for the Discovery Engine from available scan data.
 * Combines gender, visual attributes (if available from CLIP), item type, and fiber term.
 * Appends "shop" to bias results toward product/shop pages rather than editorial content.
 *
 * @param {string} itemType - garment type, e.g. "T-Shirt"
 * @param {string} fiberTerm - sustainable fiber alternative, e.g. "organic cotton"
 * @param {boolean} sustainableOnly - reserved for future use
 * @param {object|null} imageDescription - visual attributes from CLIP, or null
 * @param {string|null} gender - "mens" or "womens", or null if not specified
 * @returns {string} search query string, e.g. "womens navy blue t-shirt organic cotton shop"
 */
function buildSearchQuery(itemType, fiberTerm, sustainableOnly, imageDescription = null, gender = null) {
  const parts = [];

  // prepend gender prefix for more targeted results (e.g. "womens" → avoids men's fits)
  if (gender) {
    parts.push(gender);
  }

  // use CLIP visual attributes if available — gives more specific results than item type alone
  if (imageDescription) {
    // add detected colour (e.g. "navy blue") for colour-matching results
    if (imageDescription.color) {
      parts.push(imageDescription.color);
    }
    // add detected pattern only if it's not "solid color" (which adds no useful signal)
    if (imageDescription.pattern && imageDescription.pattern !== 'solid color') {
      parts.push(imageDescription.pattern);
    }
    // prefer CLIP's garment type over the scan form type — it's more specific
    if (imageDescription.garmentType) {
      parts.push(imageDescription.garmentType);
    } else if (itemType && itemType !== 'Garment') {
      // fall back to scan form garment type if CLIP didn't detect one
      parts.push(itemType);
    }
  } else {
    // no image: use the scan form item type directly
    if (itemType && itemType !== 'Garment') {
      parts.push(itemType);
    }
  }

  // add the sustainable fiber term to surface products made from better materials
  if (fiberTerm) {
    parts.push(fiberTerm);
  }

  // fall back to "clothing" if we somehow have no parts (e.g. unknown garment, no fiber)
  const base = parts.join(' ') || 'clothing';
  // "shop" at the end biases discovery engine toward product listing pages
  return `${base} shop`;
}

/**
 * Return a more sustainable fiber alternative to use in the search query.
 * When a user scanned a high-impact fiber (e.g. Polyester), we search for
 * a lower-impact alternative (e.g. "organic cotton") to show genuinely better options.
 *
 * @param {string} fiber - primary fiber name from the scan, e.g. "Polyester"
 * @returns {string} sustainable alternative term, or the original fiber if no mapping exists
 */
function getSustainableFiberAlternative(fiber) {
  if (!fiber) return '';

  // substitution map: synthetic/high-impact fibers → natural/regenerated alternatives
  const alternatives = {
    Polyester: 'organic cotton',        // polyester has high microplastic shedding
    Nylon: 'Tencel',                    // nylon is oil-based; Tencel is wood-pulp derived
    Acrylic: 'merino wool',             // acrylic is synthetic; merino is natural
    Spandex: 'organic cotton stretch',  // spandex is petroleum-based
    Elastane: 'organic cotton stretch', // elastane = spandex, different name
    Cotton: 'organic cotton',           // conventional cotton uses heavy pesticides
    Rayon: 'Tencel lyocell',            // rayon/viscose has harsh chemical processing
    Viscose: 'Tencel lyocell',          // same as rayon
    Bamboo: 'linen',                    // bamboo is often chemically processed into viscose
  };

  // return the mapped alternative, or fall back to the original fiber name
  return alternatives[fiber] || fiber;
}

/**
 * Check whether the web search pipeline is configured and ready to use.
 * Delegates to vertexAiService.isConfigured() which checks for the
 * GOOGLE_APPLICATION_CREDENTIALS service account file.
 *
 * @returns {boolean} true if the service account credentials file path is set
 */
function isConfigured() {
  // require() here avoids a circular dependency at module load time
  const vertexAi = require('./vertexAiService');
  return vertexAi.isConfigured();
}

module.exports = {
  searchAlternatives,
  describeGarmentImage,
  isConfigured,
};
