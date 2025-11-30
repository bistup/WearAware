// author: caitriona mccann
// date: 27/11/2025
// connects to google cloud vision api to read text from clothing labels
// extracts fiber composition and country of origin from the scanned images

// Note: process.env doesn't work in React Native, so we hardcode the API key
const GOOGLE_VISION_API_KEY = 'YOUR_GOOGLE_VISION_API_KEY';
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

// send image to google vision api for text recognition
export const processImageWithVision = async (base64Image) => {
  try {
    const requestBody = {
      requests: [
        {
          image: {
            content: base64Image,
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 1,
            },
          ],
        },
      ],
    };

    // call vision api
    const response = await fetch(VISION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    // check for api errors
    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Vision API request failed',
      };
    }

    // extract text from response
    const textAnnotations = data.responses[0]?.textAnnotations;
    if (!textAnnotations || textAnnotations.length === 0) {
      return {
        success: false,
        error: 'No text detected in image',
      };
    }

    const extractedText = textAnnotations[0].description;

    // parse the text to find fibers and country
    const parsedData = parseCareLabelText(extractedText);

    return {
      success: true,
      data: parsedData,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to process image',
    };
  }
};

// extract fiber composition and country from label text
const parseCareLabelText = (text) => {
  const lines = text.split('\n').map((line) => line.trim()).filter(line => line.length > 0);

  // find fibers with percentages
  const fibers = [];
  const fiberRegex = /(\d+)%?\s*(cotton|polyester|wool|silk|linen|nylon|acrylic|spandex|rayon|elastane|viscose|modal|lyocell|tencel|bamboo)/gi;

  let match;
  const processedFibers = new Map(); // avoid duplicates
  
  while ((match = fiberRegex.exec(text)) !== null) {
    const percentage = parseInt(match[1]);
    const fiberName = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
    
    // Only add if percentage is reasonable (1-100)
    if (percentage > 0 && percentage <= 100) {
      if (!processedFibers.has(fiberName)) {
        processedFibers.set(fiberName, percentage);
      }
    }
  }

  // Convert map to array
  processedFibers.forEach((percentage, name) => {
    fibers.push({ name, percentage });
  });

  // Normalize percentages if they don't add up to 100
  const total = fibers.reduce((sum, f) => sum + f.percentage, 0);
  if (total > 0 && total !== 100) {
    fibers.forEach(f => {
      f.percentage = Math.round((f.percentage / total) * 100);
    });
  }

  // Extract brand - look for brand indicators or use first clean line
  const brand = extractBrand(lines);

  // Extract "Made in" information
  const madeIn = extractMadeIn(text);

  // Determine item type (simple heuristic)
  const itemType = detectItemType(text);

  // Calculate environmental score
  const { score, grade } = calculateImpactFromFibers(fibers);

  return {
    brand,
    itemType,
    madeIn,
    fibers,
    score,
    grade,
    rawText: text,
    scanType: 'camera',
  };
};

const extractBrand = (lines) => {
  // Filter out lines that are likely not brand names
  const excludePatterns = [
    /^\d+%/,  // Lines starting with percentages
    /made in/i,
    /wash/i,
    /care/i,
    /cotton|polyester|wool|silk|linen|nylon|acrylic|spandex|rayon|elastane|viscose/i,
    /size|small|medium|large|xl|xxl/i,
    /^\d+$/,  // Only numbers
    /import|export/i,
    /rn\s*\d+/i,  // RN numbers
    /ca\s*\d+/i,  // CA numbers
  ];

  for (const line of lines) {
    // Skip empty or very short lines
    if (line.length < 2 || line.length > 40) continue;
    
    // Skip if matches exclude patterns
    if (excludePatterns.some(pattern => pattern.test(line))) continue;
    
    // This is likely the brand
    return line;
  }

  return 'Unknown Brand';
};

const extractMadeIn = (text) => {
  // Try to find "Made in [Country]" patterns
  const madeInRegex = /made\s+in\s+([a-z\s]+?)(?:\n|$|[,.]|\s+\d|\s+rn|\s+ca)/i;
  const match = text.match(madeInRegex);
  
  if (match && match[1]) {
    // Clean up the country name
    const country = match[1].trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Validate it's a reasonable country name (not too long, no numbers)
    if (country.length > 2 && country.length < 30 && !/\d/.test(country)) {
      return country;
    }
  }
  
  return 'Undetected';
};

const detectItemType = (text) => {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('shirt') || lowerText.includes('tee')) return 'Shirt';
  if (lowerText.includes('jean') || lowerText.includes('denim')) return 'Jeans';
  if (lowerText.includes('dress')) return 'Dress';
  if (lowerText.includes('sweater') || lowerText.includes('pullover')) return 'Sweater';
  if (lowerText.includes('jacket')) return 'Jacket';
  return 'Garment';
};

const calculateImpactFromFibers = (fibers) => {
  if (fibers.length === 0) {
    return { score: 50, grade: 'C' };
  }

  // Import impact calculator
  const { calculateImpactScore } = require('../utils/impactCalculator');
  return calculateImpactScore(fibers);
};


