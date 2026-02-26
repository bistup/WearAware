// author: caitriona mccann
// date: 26/02/2026
// ebay browse api service for finding second-hand clothing alternatives
// uses oauth2 client credentials flow for app-level access

const fetch = require('node-fetch');

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_CERT_ID = process.env.EBAY_CERT_ID;
const EBAY_ENV = process.env.EBAY_ENV || 'production';

const EBAY_AUTH_URL = EBAY_ENV === 'sandbox'
  ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
  : 'https://api.ebay.com/identity/v1/oauth2/token';

const EBAY_BROWSE_URL = EBAY_ENV === 'sandbox'
  ? 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search'
  : 'https://api.ebay.com/buy/browse/v1/item_summary/search';

let cachedToken = null;
let tokenExpiry = 0;

/**
 * get oauth2 access token using client credentials grant
 * caches the token until 60 seconds before expiry
 */
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');

  const response = await fetch(EBAY_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`eBay OAuth error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * search ebay for second-hand clothing items
 * filters to used/pre-owned condition within clothing category
 */
async function searchSecondHand(query, options = {}) {
  if (!EBAY_APP_ID || !EBAY_CERT_ID) {
    return {
      success: false,
      error: 'eBay API credentials not configured',
      results: [],
      notConfigured: true,
    };
  }

  const { limit = 10 } = options;

  try {
    const token = await getAccessToken();

    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      category_ids: '11450',
      filter: 'conditionIds:{3000|2500|2000|1500}',
    });

    const response = await fetch(`${EBAY_BROWSE_URL}?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_IE',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.errors?.[0]?.message || `eBay API error: ${response.status}`);
    }

    const data = await response.json();

    const results = (data.itemSummaries || []).map(item => ({
      itemId: item.itemId,
      title: item.title,
      price: item.price ? `${item.price.currency} ${item.price.value}` : null,
      priceValue: item.price ? parseFloat(item.price.value) : null,
      priceCurrency: item.price?.currency || 'USD',
      imageUrl: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || null,
      link: item.itemWebUrl,
      condition: item.condition || 'Pre-Owned',
      seller: item.seller?.username || null,
      sellerRating: item.seller?.feedbackPercentage || null,
      location: item.itemLocation?.city
        ? `${item.itemLocation.city}${item.itemLocation.stateOrProvince ? ', ' + item.itemLocation.stateOrProvince : ''}`
        : null,
      shippingCost: item.shippingOptions?.[0]?.shippingCost?.value
        ? `${item.shippingOptions[0].shippingCost.currency} ${item.shippingOptions[0].shippingCost.value}`
        : 'See listing',
    }));

    return {
      success: true,
      results,
      total: data.total || results.length,
    };
  } catch (error) {
    console.error('eBay search error:', error.message);
    return { success: false, error: error.message, results: [] };
  }
}

/**
 * check if ebay api credentials are configured
 */
function isConfigured() {
  return !!(EBAY_APP_ID && EBAY_CERT_ID);
}

module.exports = { searchSecondHand, isConfigured };
