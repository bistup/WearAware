// author: caitriona mccann
// date: 26/02/2026
// vertex ai search service for finding sustainable product alternatives
// uses discovery engine api to search indexed sustainable brand websites
// extracts og:image from result pages for product thumbnail display

const fetch = require('node-fetch');
const { GoogleAuth } = require('google-auth-library');

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'wearaware';
const VERTEX_ENGINE_ID = process.env.VERTEX_ENGINE_ID || 'wearaware-search_1772041502704';
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || 'global';

const DISCOVERY_ENGINE_URL = `https://discoveryengine.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${VERTEX_LOCATION}/collections/default_collection/engines/${VERTEX_ENGINE_ID}/servingConfigs/default_search:search`;

let authClient = null;

/**
 * get an authenticated access token using the service account
 * uses GOOGLE_APPLICATION_CREDENTIALS env var pointing to the service account json
 */
async function getAccessToken() {
  if (!authClient) {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    authClient = await auth.getClient();
  }
  const { token } = await authClient.getAccessToken();
  return token;
}

/**
 * search vertex ai discovery engine for sustainable clothing alternatives
 * queries the indexed sustainable brand websites and extracts og:image for thumbnails
 */
async function groundedSearch(query, limit = 8) {
  try {
    const token = await getAccessToken();

    const response = await fetch(DISCOVERY_ENGINE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        pageSize: limit,
        queryExpansionSpec: {
          condition: 'AUTO',
        },
        spellCorrectionSpec: {
          mode: 'AUTO',
        },
      }),
      timeout: 15000,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `Discovery Engine error: ${response.status}`;
      console.error('Vertex AI Search error:', errorMsg);
      return { success: false, error: errorMsg, results: [] };
    }

    const data = await response.json();
    const searchResults = data.results || [];

    if (searchResults.length === 0) {
      return { success: true, results: [], totalResults: 0 };
    }

    // parse results and extract og:image for each
    const results = await parseSearchResults(searchResults, limit);

    return {
      success: true,
      results,
      totalResults: parseInt(data.totalSize || results.length),
    };
  } catch (error) {
    console.error('Vertex AI Search error:', error.message);
    return { success: false, error: error.message, results: [] };
  }
}

/**
 * parse discovery engine search results into product cards
 * extracts images from pagemap data (cse_image, og:image) returned by discovery engine
 */
function parseSearchResults(searchResults, limit) {
  const parsed = [];

  for (const result of searchResults.slice(0, limit)) {
    const doc = result.document;
    if (!doc) continue;

    const derivedData = doc.derivedStructData || {};
    const pagemap = derivedData.pagemap || {};
    const metatags = pagemap.metatags?.[0] || {};

    const link = derivedData.link || derivedData.formattedUrl || '';
    const title = derivedData.title || derivedData.htmlTitle || '';
    const snippet = derivedData.snippets?.[0]?.snippet ||
                    derivedData.htmlFormattedUrl || '';
    const domain = extractDomain(link);

    // extract product image from pagemap data (no extra HTTP requests needed)
    const imageUrl = pagemap.cse_image?.[0]?.src ||
                     metatags['og:image'] ||
                     metatags['og:image:secure_url'] ||
                     metatags['twitter:image'] ||
                     null;
    const thumbnailUrl = pagemap.cse_thumbnail?.[0]?.src || imageUrl;

    // extract price from metatags if available
    const metaPrice = metatags['product:price:amount'] || metatags['og:price:amount'] || null;
    const metaCurrency = metatags['product:price:currency'] || '';
    const price = metaPrice ? `${metaCurrency} ${metaPrice}`.trim() : extractPriceFromText(snippet);

    parsed.push({
      title: cleanTitle(stripHtmlTags(title)),
      link,
      snippet: stripHtmlTags(snippet),
      imageUrl,
      thumbnailUrl,
      siteName: domain,
      price,
      brand: extractBrandFromDomain(domain),
    });
  }

  return parsed;
}

/**
 * strip html tags from text (discovery engine may return html-formatted snippets)
 */
function stripHtmlTags(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').trim();
}

/**
 * extract price from text
 */
function extractPriceFromText(text) {
  if (!text) return null;
  const priceMatch = text.match(/[\$£€]\s?\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s?(?:USD|GBP|EUR)/i);
  return priceMatch ? priceMatch[0].trim() : null;
}

/**
 * extract domain from URL
 */
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * extract brand name from domain
 */
function extractBrandFromDomain(domain) {
  if (!domain) return null;
  const name = domain.replace(/^www\./, '').replace(/^eu\./, '').split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * clean product title
 */
function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/\s*[\|\-–—]\s*(official\s+)?(site|store|shop).*$/i, '')
    .replace(/\s*[\|\-–—]\s*[^|–—]*$/, '')
    .trim();
}

/**
 * check if vertex ai search is configured
 * requires GOOGLE_APPLICATION_CREDENTIALS env var to be set
 */
function isConfigured() {
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

module.exports = { groundedSearch, isConfigured };
