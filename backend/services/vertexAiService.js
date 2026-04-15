// author: caitriona mccann
// date: 26/02/2026
// vertex ai search service for finding sustainable product alternatives
// uses discovery engine api to search indexed sustainable brand websites
// extracts og:image from result pages for product thumbnail display
//
// how it works:
//   1. authenticate using service account credentials from GOOGLE_APPLICATION_CREDENTIALS
//      (points to a json key file on the proxmox server at /opt/wearaware/backend/)
//   2. send a text query to the discovery engine (vertex ai search data store)
//      that is already pre-indexed with ~15 sustainable fashion brand sites
//   3. parse the returned documents - each has pagemap/metatags with og:image,
//      product price, and snippet text extracted by the crawler
//   4. filter out non-product pages (about, blog, careers etc)
//   5. return structured product cards to the alternatives route
//
// the discovery engine id and gcp project must match what is configured in GCP.
// if GOOGLE_APPLICATION_CREDENTIALS is not set, isConfigured() returns false
// and the alternatives route will return an empty results array.

const fetch = require('node-fetch');
const { GoogleAuth } = require('google-auth-library');

// GCP project and engine config - must match what is set up in Google Cloud Console
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'wearaware';
const VERTEX_ENGINE_ID = process.env.VERTEX_ENGINE_ID || 'wearaware-search_1772041502704';
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || 'global';

// full REST URL for the discovery engine search endpoint - built from the three config values above
const DISCOVERY_ENGINE_URL = `https://discoveryengine.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${VERTEX_LOCATION}/collections/default_collection/engines/${VERTEX_ENGINE_ID}/servingConfigs/default_search:search`;

// cached auth client - reused across requests to avoid re-reading the service account key each time
let authClient = null;

/**
 * Get an OAuth2 access token using the GCP service account.
 * Lazily creates the GoogleAuth client on first call, then reuses it.
 * The token itself is short-lived and refreshed automatically by google-auth-library.
 *
 * @returns {Promise<string>} a valid Bearer token for the Cloud Platform scope
 */
async function getAccessToken() {
  // only create the auth client once; subsequent calls reuse the cached instance
  if (!authClient) {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    // getClient() resolves the credentials from GOOGLE_APPLICATION_CREDENTIALS env var
    authClient = await auth.getClient();
  }
  // getAccessToken() returns { token, res } - we only need the token string
  const { token } = await authClient.getAccessToken();
  return token;
}

/**
 * Search the Vertex AI Discovery Engine for sustainable clothing alternatives.
 * Authenticates with the service account, sends the query, and parses results
 * into product cards with image URLs and metadata.
 *
 * @param {string} query - natural language search query, e.g. "womens organic cotton t-shirt"
 * @param {number} [limit=8] - maximum number of results to return
 * @returns {Promise<{success: boolean, results: Array, totalResults?: number, error?: string}>}
 */
async function groundedSearch(query, limit = 8) {
  try {
    // get a fresh (or cached) access token for the API call
    const token = await getAccessToken();

    // POST to the discovery engine search endpoint with spell correction and query expansion
    const response = await fetch(DISCOVERY_ENGINE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,  // service account Bearer token
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,              // the search string built by webSearchService
        pageSize: limit,           // ask for more than needed so we can filter
        queryExpansionSpec: {
          condition: 'AUTO',       // let discovery engine expand synonyms automatically
        },
        spellCorrectionSpec: {
          mode: 'AUTO',            // auto-correct typos in the query
        },
      }),
      timeout: 15000,              // 15s timeout — discovery engine is usually fast
    });

    // non-2xx means the API returned an error (bad credentials, wrong engine ID, etc.)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `Discovery Engine error: ${response.status}`;
      console.error('Vertex AI Search error:', errorMsg);
      return { success: false, error: errorMsg, results: [] };
    }

    const data = await response.json();
    // results is an array of document objects; empty if no matches
    const searchResults = data.results || [];

    // return early with empty array so caller doesn't need to handle null
    if (searchResults.length === 0) {
      return { success: true, results: [], totalResults: 0 };
    }

    // convert raw discovery engine documents to structured product cards
    const results = await parseSearchResults(searchResults, limit);

    return {
      success: true,
      results,
      // totalSize from the API is a string; fall back to actual result count
      totalResults: parseInt(data.totalSize || results.length),
    };
  } catch (error) {
    console.error('Vertex AI Search error:', error.message);
    // return failure shape so the route can handle it gracefully
    return { success: false, error: error.message, results: [] };
  }
}

/**
 * Parse raw Discovery Engine result documents into structured product cards.
 * All image extraction is done from pagemap data already returned by the crawler —
 * no additional HTTP requests are made to fetch product images.
 *
 * @param {Array} searchResults - raw result objects from the Discovery Engine response
 * @param {number} limit - maximum number of cards to return
 * @returns {Array} array of product card objects with title, link, imageUrl, price, brand, etc.
 */
function parseSearchResults(searchResults, limit) {
  const parsed = [];

  // iterate up to limit results (we may have requested more to allow for filtering)
  for (const result of searchResults.slice(0, limit)) {
    const doc = result.document;
    // skip malformed results that have no document object
    if (!doc) continue;

    // derivedStructData is where discovery engine puts crawled page metadata
    const derivedData = doc.derivedStructData || {};
    // pagemap contains structured data extracted from the page (metatags, images, etc.)
    const pagemap = derivedData.pagemap || {};
    // metatags[0] holds og:image, og:price, twitter:image etc.
    const metatags = pagemap.metatags?.[0] || {};

    // extract the core page fields, falling back to alternate field names
    const link = derivedData.link || derivedData.formattedUrl || '';
    const title = derivedData.title || derivedData.htmlTitle || '';
    const snippet = derivedData.snippets?.[0]?.snippet ||
                    derivedData.htmlFormattedUrl || '';
    const domain = extractDomain(link);

    // image priority: cse_image (google crawler) > og:image > og:image:secure_url > twitter:image
    // this means we never need extra HTTP calls to get product images
    const imageUrl = pagemap.cse_image?.[0]?.src ||
                     metatags['og:image'] ||
                     metatags['og:image:secure_url'] ||
                     metatags['twitter:image'] ||
                     null;
    // thumbnail: prefer cse_thumbnail (pre-cropped by google), fall back to full image
    const thumbnailUrl = pagemap.cse_thumbnail?.[0]?.src || imageUrl;

    // price: prefer structured metatag data; fall back to regex extraction from snippet text
    const metaPrice = metatags['product:price:amount'] || metatags['og:price:amount'] || null;
    const metaCurrency = metatags['product:price:currency'] || '';
    const price = metaPrice ? `${metaCurrency} ${metaPrice}`.trim() : extractPriceFromText(snippet);

    // build the product card object - strip HTML tags from title and snippet
    parsed.push({
      title: cleanTitle(stripHtmlTags(title)),
      link,
      snippet: stripHtmlTags(snippet),   // snippets may contain <b> tags from discovery engine
      imageUrl,
      thumbnailUrl,
      siteName: domain,
      price,
      brand: extractBrandFromDomain(domain),  // e.g. "patagonia.com" → "Patagonia"
    });
  }

  return parsed;
}

/**
 * Remove HTML tags from a string.
 * Discovery Engine snippets and titles sometimes contain <b> or other tags.
 *
 * @param {string} text - raw string possibly containing HTML
 * @returns {string} plain text with all tags stripped
 */
function stripHtmlTags(text) {
  if (!text) return '';
  // replace anything between < and > (greedy enough for simple inline tags)
  return text.replace(/<[^>]*>/g, '').trim();
}

/**
 * Try to extract a price string from plain text using a regex.
 * Used as a fallback when structured price metatags are absent.
 * Matches currency symbols (£$€) followed by digits, or digits followed by currency codes.
 *
 * @param {string} text - snippet text to scan
 * @returns {string|null} matched price string, e.g. "€45.00", or null if not found
 */
function extractPriceFromText(text) {
  if (!text) return null;
  // match patterns like "$45", "£12.99", "45 EUR", "€100"
  const priceMatch = text.match(/[\$£€]\s?\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s?(?:USD|GBP|EUR)/i);
  return priceMatch ? priceMatch[0].trim() : null;
}

/**
 * Extract the bare domain (without www.) from a full URL.
 * Used to display the site name on product cards.
 *
 * @param {string} url - full URL, e.g. "https://www.patagonia.com/product/..."
 * @returns {string|null} domain string, e.g. "patagonia.com", or null if URL is invalid
 */
function extractDomain(url) {
  try {
    // new URL() parses the URL; hostname includes subdomain but not path
    const hostname = new URL(url).hostname;
    // strip leading www. so we get "patagonia.com" not "www.patagonia.com"
    return hostname.replace(/^www\./, '');
  } catch {
    // URL constructor throws on relative or malformed URLs
    return null;
  }
}

/**
 * Derive a human-readable brand name from a domain string.
 * Strips www. and eu. subdomains, takes the first segment before the TLD,
 * and capitalises the first letter.
 *
 * @param {string} domain - e.g. "patagonia.com" or "eu.tentree.com"
 * @returns {string|null} brand name, e.g. "Patagonia" or "Tentree"
 */
function extractBrandFromDomain(domain) {
  if (!domain) return null;
  // remove common subdomains that aren't the brand name
  const name = domain.replace(/^www\./, '').replace(/^eu\./, '').split('.')[0];
  // capitalise the first character so "patagonia" → "Patagonia"
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Clean a product page title by stripping the site name suffix.
 * Discovery Engine titles often include " | Brand" or " - Official Store" at the end.
 * Removing this makes the title more useful as a product card heading.
 *
 * @param {string} title - raw page title, e.g. "Organic Cotton T-Shirt | Patagonia"
 * @returns {string} cleaned title, e.g. "Organic Cotton T-Shirt"
 */
function cleanTitle(title) {
  if (!title) return '';
  return title
    // remove " | Official Site", " - Official Store", " | Shop" etc.
    .replace(/\s*[\|\-–—]\s*(official\s+)?(site|store|shop).*$/i, '')
    // remove any remaining " | Whatever" or " - Whatever" suffix (the brand name)
    .replace(/\s*[\|\-–—]\s*[^|–—]*$/, '')
    .trim();
}

/**
 * Check whether Vertex AI Search is configured and ready to use.
 * Returns false if the service account credentials file path is not set,
 * which causes the alternatives route to return an empty results array
 * rather than failing with an auth error.
 *
 * @returns {boolean} true if GOOGLE_APPLICATION_CREDENTIALS env var is set
 */
function isConfigured() {
  // just checks for the env var; doesn't validate the file or the credentials
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

module.exports = { groundedSearch, isConfigured };
