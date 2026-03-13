// author: caitriona mccann
// date: 12/03/2026
// charity shops route - proxies Google Places API (New) to find nearby charity/thrift shops
// keeps API key server-side for security
// uses a known list of charity shop names in Ireland/NI/UK to filter results

const express = require('express');
const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// known charity shop organisations in Ireland, Northern Ireland and UK
const CHARITY_SHOP_NAMES = [
  // ireland
  'st vincent de paul', 'svp', 'vincent', 'vincents',
  'oxfam',
  'enable ireland',
  'vision ireland', 'ncbi',
  'barnardos',
  'irish cancer society',
  'irish heart foundation',
  'trocaire', 'trócaire',
  'dublin simon', 'simon community',
  'concern', 'concern worldwide',
  'goal',
  'irish wheelchair association',
  'irish red cross',
  'debra ireland',
  'gorta',
  'haven',
  'laura lynn',
  'jack and jill',
  'barretstown',
  'pieta house',
  'cope',
  'rehab',
  'national council for the blind',
  // northern ireland
  'british heart foundation', 'bhf',
  'british red cross',
  'cancer research',
  'cancer focus',
  'age ni', 'age uk', 'age concern',
  'marie curie',
  'air ambulance',
  'hospice', 'foyle hospice', 'northern ireland hospice',
  'action cancer',
  'sue ryder',
  'mind',
  'shelter',
  'salvation army',
  'ymca',
  'blythswood',
  'scope',
  'pdsa',
  'rspca',
  'cats protection',
  'dogs trust',
  'assisi',
  'east belfast mission',
  'restore',
  'save the children',
  'children in need',
  'nspcc',
  "children's society",
  'mencap',
  'sense',
  'macmillan',
  'diabetes uk',
  'stroke association',
  'alzheimers',
  "parkinson",
  // generic charity/thrift terms
  'charity shop', 'thrift', 'second hand', 'secondhand',
  'vintage', 'preloved', 'pre-loved',
  'goodwill',
];

// check if a place name matches a known charity shop
function isCharityShop(placeName, placeTypes) {
  const nameLower = placeName.toLowerCase();

  // check against known charity names
  for (const charity of CHARITY_SHOP_NAMES) {
    if (nameLower.includes(charity)) return true;
  }

  // also accept if Google categorized it as a thrift/second-hand store
  const charityTypes = [
    'thrift_store',
    'second_hand_store',
    'used_clothing_store',
    'donation_center',
  ];
  if (placeTypes && placeTypes.some(t => charityTypes.includes(t))) return true;

  return false;
}

// GET /api/charity-shops/nearby?lat=...&lng=...&radius=...
router.get('/nearby', async (req, res) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ success: false, error: 'lat and lng are required' });
  }

  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ success: false, error: 'Google Places API key not configured' });
  }

  const searchRadius = Math.min(parseInt(radius) || 5000, 50000);

  try {
    // search for charity shops using targeted queries
    const keywords = [
      'charity shop',
      'thrift store',
      'Oxfam',
      'St Vincent de Paul',
      'British Heart Foundation',
      'Cancer Research shop',
    ];
    const allPlaces = [];
    const seenIds = new Set();

    for (const keyword of keywords) {
      const requestBody = {
        textQuery: keyword,
        locationBias: {
          circle: {
            center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
            radius: searchRadius * 1.2,
          },
        },
        maxResultCount: 20,
      };

      const response = await fetch(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours,places.types',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      if (data.places) {
        for (const place of data.places) {
          if (!seenIds.has(place.id)) {
            const name = place.displayName?.text || 'Unknown';
            const types = place.types || [];

            // only include if it matches a known charity shop
            if (isCharityShop(name, types)) {
              seenIds.add(place.id);
              allPlaces.push({
                id: place.id,
                name,
                address: place.formattedAddress || '',
                lat: place.location?.latitude,
                lng: place.location?.longitude,
                rating: place.rating || null,
                totalRatings: place.userRatingCount || 0,
                openNow: place.currentOpeningHours?.openNow ?? null,
                types,
              });
            }
          }
        }
      }
    }

    // sort by distance from user
    allPlaces.sort((a, b) => {
      const distA = getDistance(parseFloat(lat), parseFloat(lng), a.lat, a.lng);
      const distB = getDistance(parseFloat(lat), parseFloat(lng), b.lat, b.lng);
      return distA - distB;
    });

    // add distance and filter to only include results within the radius
    const results = allPlaces
      .map(place => ({
        ...place,
        distance: getDistance(parseFloat(lat), parseFloat(lng), place.lat, place.lng),
      }))
      .filter(place => place.distance <= searchRadius);

    res.json({
      success: true,
      shops: results,
      total: results.length,
    });
  } catch (error) {
    console.error('Error fetching charity shops:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// haversine formula for distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

module.exports = router;
