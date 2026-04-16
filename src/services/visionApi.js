// author: caitriona mccann
// date: 27/11/2025
// last updated: 14/04/2026
// google cloud vision api integration - OCR for clothing care labels
//
// flow:
//   CameraScreen captures photo → hybridOcr.js reads it as base64
//   → processImageWithVision() sends it to Cloud Vision TEXT_DETECTION
//   → parseCareLabelText() extracts fiber composition, brand, country, care instructions
//   → impactCalculator.calculateImpactScore() computes the sustainability score
//
// GOOGLE_VISION_API_KEY is loaded from .env via babel-plugin-module-resolver
// (configured in babel.config.js under module-resolver plugins)

import Constants from 'expo-constants';
// loaded from app.config.js extra (baked in at build time via process.env on EAS)
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${Constants.expoConfig.extra.googleVisionApiKey}`;

/**
 * Send a base64-encoded image to Google Cloud Vision API for OCR.
 * Requests both TEXT_DETECTION (full OCR) and LABEL_DETECTION (object labels).
 * On success, passes the extracted text to parseCareLabelText() and returns
 * the parsed care label data. On failure, returns { success: false, error }.
 *
 * @param {string} base64Image - raw base64 string (no data: prefix) from expo-file-system
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const processImageWithVision = async (base64Image) => {
  try {
    // build the Vision API request body — one image, two feature types
    const requestBody = {
      requests: [
        {
          image: {
            content: base64Image,  // base64-encoded image bytes
          },
          features: [
            {
              type: 'TEXT_DETECTION',   // full OCR — returns all text in the image
              maxResults: 1,            // 1 result is sufficient; TEXT_DETECTION returns one block
            },
            {
              type: 'LABEL_DETECTION',  // object/category labels — currently unused but retained
              maxResults: 10,
            },
          ],
        },
      ],
    };

    // POST to Vision API — no auth header needed, key is in the URL
    const response = await fetch(VISION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    // non-2xx means the API rejected the request (bad key, quota exceeded, etc.)
    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Vision API request failed',
      };
    }

    // textAnnotations is an array; [0] is the full-text annotation covering the whole image
    const textAnnotations = data.responses[0]?.textAnnotations;
    if (!textAnnotations || textAnnotations.length === 0) {
      // Vision found no text — label may be too blurry, too small, or non-text
      return {
        success: false,
        error: 'No text detected in image',
      };
    }

    // description on the first annotation is the full concatenated text of the image
    const extractedText = textAnnotations[0].description;

    // parse the raw OCR text into structured care label data
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

/**
 * Parse raw OCR text from a clothing care label into structured data.
 * Extracts fiber composition (with percentages), brand name, country of origin,
 * care instructions, and calculates an initial sustainability score.
 *
 * @param {string} text - raw OCR text from Vision API textAnnotations[0].description
 * @returns {object} parsed care label: { brand, itemType, madeIn, fibers, score, grade, careInstructions, rawText, scanType }
 */
const parseCareLabelText = (text) => {
  // split text into individual lines for brand extraction heuristics
  const lines = text.split('\n').map((line) => line.trim()).filter(line => line.length > 0);

  // ── fiber extraction ──────────────────────────────────────────────────
  const fibers = [];
  // regex matches "60% Cotton", "40 Polyester", "Wool 80%" etc.
  const fiberRegex = /(\d+)%?\s*(cotton|polyester|wool|silk|linen|nylon|acrylic|spandex|rayon|elastane|viscose|modal|lyocell|tencel|bamboo)/gi;

  let match;
  // use a Map to deduplicate fibers — same fiber can appear multiple times in bilingual labels
  const processedFibers = new Map();

  while ((match = fiberRegex.exec(text)) !== null) {
    const percentage = parseInt(match[1]);
    // normalise fiber name: capitalise first letter, lowercase remainder
    const fiberName = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();

    // sanity check: only accept percentages in the 1–100 range
    if (percentage > 0 && percentage <= 100) {
      // first occurrence wins — bilingual labels often repeat the same composition
      if (!processedFibers.has(fiberName)) {
        processedFibers.set(fiberName, percentage);
      }
    }
  }

  // convert the deduplication Map to the array format expected by impactCalculator
  processedFibers.forEach((percentage, name) => {
    fibers.push({ name, percentage });
  });

  // normalise percentages if the total doesn't add up to 100
  // this handles labels like "55% Cotton 44% Polyester" (total 99 due to rounding)
  const total = fibers.reduce((sum, f) => sum + f.percentage, 0);
  if (total > 0 && total !== 100) {
    fibers.forEach(f => {
      f.percentage = Math.round((f.percentage / total) * 100);
    });
  }

  // ── brand, origin, item type, care instructions ───────────────────────
  const brand = extractBrand(lines);              // heuristic: first clean, short line
  const madeIn = extractMadeIn(text);             // regex: "Made in [Country]"
  const itemType = detectItemType(text);          // keyword match: "shirt", "jeans", etc.
  const careInstructions = extractCareInstructions(text);  // washing, drying, ironing etc.

  // calculate an initial sustainability score from the extracted fibers
  // (the backend will recalculate authoritatively when the scan is saved)
  const { score, grade } = calculateImpactFromFibers(fibers);

  return {
    brand,
    itemType,
    madeIn,
    fibers,
    score,
    grade,
    careInstructions,
    rawText: text,          // keep the original OCR text for debugging and future re-parsing
    scanType: 'camera',     // flag this as a camera scan (vs. 'manual' from ManualInputScreen)
  };
};

/**
 * Attempt to identify the brand name from the OCR lines.
 * Uses an exclusion list to skip lines that are clearly not brand names
 * (percentages, fiber names, care keywords, size labels, RN/CA registration numbers).
 * Falls back to 'Unknown Brand' if nothing suitable is found.
 *
 * @param {string[]} lines - array of individual text lines from the label
 * @returns {string} brand name, or 'Unknown Brand'
 */
const extractBrand = (lines) => {
  // patterns that indicate a line is NOT a brand name
  const excludePatterns = [
    /^\d+%/,      // lines starting with a percentage (fiber composition)
    /made in/i,   // country of origin
    /wash/i,      // care instructions
    /care/i,      // care instructions
    /cotton|polyester|wool|silk|linen|nylon|acrylic|spandex|rayon|elastane|viscose/i,  // fiber names
    /size|small|medium|large|xl|xxl/i,  // size labels
    /^\d+$/,      // lines containing only numbers
    /import|export/i,
    /rn\s*\d+/i,  // RN (Registered Number) — US textile identification
    /ca\s*\d+/i,  // CA number — Canadian textile identification
  ];

  for (const line of lines) {
    // brand names are typically 2–40 characters long
    if (line.length < 2 || line.length > 40) continue;

    // skip any line that matches one of the exclusion patterns
    if (excludePatterns.some(pattern => pattern.test(line))) continue;

    // the first line that survives the filters is most likely the brand
    return line;
  }

  return 'Unknown Brand';
};

/**
 * Extract the country of origin from label text using a "Made in X" pattern.
 * Validates the result is a plausible country name (length 3–29 chars, no digits).
 *
 * @param {string} text - full OCR text
 * @returns {string} country name (e.g. "Bangladesh"), or 'Undetected'
 */
const extractMadeIn = (text) => {
  // match "Made in Bangladesh", "MADE IN CHINA", etc.
  // stop before newlines, commas, periods, digits (to avoid matching "Made in 2024")
  const madeInRegex = /made\s+in\s+([a-z\s]+?)(?:\n|$|[,.]|\s+\d|\s+rn|\s+ca)/i;
  const match = text.match(madeInRegex);

  if (match && match[1]) {
    // capitalise each word of the country name (e.g. "new zealand" → "New Zealand")
    const country = match[1].trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // validate: country name should be a reasonable length and contain no digits
    if (country.length > 2 && country.length < 30 && !/\d/.test(country)) {
      return country;
    }
  }

  return 'Undetected';
};

/**
 * Detect garment type from label text using simple keyword matching.
 * Returns the first matched type, or 'Garment' if nothing specific is found.
 *
 * @param {string} text - full OCR text
 * @returns {string} garment type, e.g. "Shirt", "Jeans", "Dress"
 */
const detectItemType = (text) => {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('shirt') || lowerText.includes('tee')) return 'Shirt';
  if (lowerText.includes('jean') || lowerText.includes('denim')) return 'Jeans';
  if (lowerText.includes('dress')) return 'Dress';
  if (lowerText.includes('sweater') || lowerText.includes('pullover')) return 'Sweater';
  if (lowerText.includes('jacket')) return 'Jacket';
  // fall back to generic "Garment" if no type keyword matched
  return 'Garment';
};

/**
 * Extract care instructions from label text, including wash temperatures,
 * bleaching, drying, ironing, and dry cleaning instructions.
 * Returns an array of structured instruction objects for display in CareInstructionsScreen.
 *
 * @param {string} text - full OCR text from the care label
 * @returns {Array<{type: string, instruction: string, iconName?: string, temperature?: number|string}>}
 */
const extractCareInstructions = (text) => {
  const lowerText = text.toLowerCase();
  const instructions = [];

  // extract all temperature numbers from the text for wash/iron temperature matching
  const tempMatch = text.match(/(\d+)[°º]?\s*[CF]?/g);
  const temperatures = tempMatch ? tempMatch.map(t => parseInt(t)) : [];

  // ── washing ───────────────────────────────────────────────────────────

  if (lowerText.includes('machine wash') || lowerText.includes('wash with')) {
    // determine the wash temperature from detected numbers or temperature keywords
    if (temperatures.includes(30) || lowerText.includes('cold') || lowerText.includes('30')) {
      instructions.push({
        type: 'wash',
        instruction: 'Machine wash cold at 30°C',
        iconName: 'wash-30',
        temperature: 30
      });
    } else if (temperatures.includes(40) || lowerText.includes('warm') || lowerText.includes('40')) {
      instructions.push({
        type: 'wash',
        instruction: 'Machine wash warm at 40°C',
        iconName: 'wash-40',
        temperature: 40
      });
    } else if (temperatures.includes(50) || lowerText.includes('50')) {
      instructions.push({
        type: 'wash',
        instruction: 'Machine wash at 50°C',
        iconName: 'wash-50',
        temperature: 50
      });
    } else if (temperatures.includes(60) || lowerText.includes('60')) {
      instructions.push({
        type: 'wash',
        instruction: 'Machine wash hot at 60°C',
        iconName: 'wash-60',
        temperature: 60
      });
    } else if (temperatures.includes(70) || lowerText.includes('70')) {
      instructions.push({
        type: 'wash',
        instruction: 'Machine wash hot at 70°C',
        iconName: 'wash-70',
        temperature: 70
      });
    } else if (temperatures.includes(95) || lowerText.includes('95')) {
      instructions.push({
        type: 'wash',
        instruction: 'Machine wash very hot at 95°C',
        iconName: 'wash-95',
        temperature: 95
      });
    } else if (lowerText.includes('permanent press') || lowerText.includes('perm press')) {
      instructions.push({
        type: 'wash',
        instruction: 'Machine wash permanent press',
        iconName: 'wash-permanent-press'
      });
    } else if (lowerText.includes('delicate') || lowerText.includes('gentle')) {
      instructions.push({
        type: 'wash',
        instruction: 'Machine wash delicate / gentle cycle',
        iconName: 'wash-delicate'
      });
    } else {
      // no temperature detected — just record "Machine wash"
      instructions.push({
        type: 'wash',
        instruction: 'Machine wash',
        iconName: 'wash-machine'
      });
    }
  }

  if (lowerText.includes('hand wash')) {
    instructions.push({
      type: 'wash',
      instruction: 'Hand wash only',
      iconName: 'wash-hand'
    });
  }
  if (lowerText.includes('do not wash')) {
    instructions.push({
      type: 'wash',
      instruction: 'Do not wash',
      iconName: 'wash-no'
    });
  }

  // ── bleaching ─────────────────────────────────────────────────────────

  if (lowerText.includes('do not bleach') || lowerText.includes('no bleach')) {
    instructions.push({
      type: 'bleach',
      instruction: 'Do not bleach',
      iconName: 'bleach-no'
    });
  } else if (lowerText.includes('bleach')) {
    if (lowerText.includes('non-chlorine') || lowerText.includes('oxygen')) {
      // non-chlorine / oxygen bleach is gentler and safer for colours
      instructions.push({
        type: 'bleach',
        instruction: 'Non-chlorine bleach only',
        iconName: 'bleach-non-chlorine'
      });
    } else {
      instructions.push({
        type: 'bleach',
        instruction: 'Bleach when needed',
        iconName: 'bleach'
      });
    }
  }

  // ── drying ────────────────────────────────────────────────────────────

  if (lowerText.includes('tumble dry')) {
    // detect tumble dry heat level from keywords
    if (lowerText.includes('low') || lowerText.includes('delicate')) {
      instructions.push({
        type: 'dry',
        instruction: 'Tumble dry low heat',
        iconName: 'tumble-dry-low',
        temperature: 'low'
      });
    } else if (lowerText.includes('medium') || lowerText.includes('normal')) {
      instructions.push({
        type: 'dry',
        instruction: 'Tumble dry medium heat',
        iconName: 'tumble-dry-medium',
        temperature: 'medium'
      });
    } else if (lowerText.includes('high')) {
      instructions.push({
        type: 'dry',
        instruction: 'Tumble dry high heat',
        iconName: 'tumble-dry-high',
        temperature: 'high'
      });
    } else if (lowerText.includes('no heat') || lowerText.includes('air')) {
      instructions.push({
        type: 'dry',
        instruction: 'Tumble dry no heat / Air dry',
        iconName: 'tumble-dry-no-heat'
      });
    } else {
      // tumble dry without a specified heat level
      instructions.push({
        type: 'dry',
        instruction: 'Tumble dry',
        iconName: 'tumble-dry'
      });
    }
  }
  if (lowerText.includes('do not tumble')) {
    instructions.push({
      type: 'dry',
      instruction: 'Do not tumble dry',
      iconName: 'tumble-dry-no'
    });
  }
  // line dry / hang dry often co-occurs with "do not tumble"
  if (lowerText.includes('do not tumble') || lowerText.includes('line dry') || lowerText.includes('hang dry')) {
    instructions.push({
      type: 'dry',
      instruction: 'Line dry / Hang to dry (do not tumble)',
      icon: '⬜|',
      symbol: 'vertical line'
    });
  }
  if (lowerText.includes('lay flat') || lowerText.includes('dry flat')) {
    instructions.push({
      type: 'dry',
      instruction: 'Lay flat to dry',
      icon: '⬜—',
      symbol: 'horizontal line'
    });
  }
  if (lowerText.includes('drip dry')) {
    instructions.push({
      type: 'dry',
      instruction: 'Drip dry',
      icon: '⬜|∿',
      symbol: 'vertical line with drops'
    });
  }
  if (lowerText.includes('shade') || lowerText.includes('dry in shade')) {
    instructions.push({
      type: 'dry',
      instruction: 'Dry in shade',
      icon: '⬜╱',
      symbol: 'line with diagonal stripes'
    });
  }

  // ── ironing ───────────────────────────────────────────────────────────

  if (lowerText.includes('iron')) {
    // filter temperatures to the iron range (100–200°C) to avoid matching wash temps
    const ironTemps = temperatures.filter(t => t >= 100 && t <= 200);

    if (lowerText.includes('do not iron')) {
      instructions.push({
        type: 'iron',
        instruction: 'Do not iron',
        iconName: 'iron-no'
      });
    } else if (lowerText.includes('low') || lowerText.includes('cool') || ironTemps.includes(110)) {
      instructions.push({
        type: 'iron',
        instruction: 'Iron on low heat (110°C / 230°F)',
        iconName: 'iron-low',
        temperature: 110
      });
    } else if (lowerText.includes('medium') || lowerText.includes('moderate') || ironTemps.includes(150)) {
      instructions.push({
        type: 'iron',
        instruction: 'Iron on medium heat (150°C / 300°F)',
        iconName: 'iron-medium',
        temperature: 150
      });
    } else if (lowerText.includes('high') || lowerText.includes('hot') || ironTemps.includes(200)) {
      instructions.push({
        type: 'iron',
        instruction: 'Iron on high heat (200°C / 390°F)',
        iconName: 'iron-high',
        temperature: 200
      });
    } else if (lowerText.includes('no steam') || lowerText.includes('without steam')) {
      instructions.push({
        type: 'iron',
        instruction: 'Iron without steam',
        iconName: 'iron-no-steam'
      });
    } else {
      // iron keyword present but no heat level detected
      instructions.push({
        type: 'iron',
        instruction: 'Iron if needed',
        iconName: 'iron'
      });
    }
  }

  // ── dry cleaning ──────────────────────────────────────────────────────

  if (lowerText.includes('do not dry clean')) {
    instructions.push({
      type: 'dryclean',
      instruction: 'Do not dry clean',
      iconName: 'dryclean-no'
    });
  } else if (lowerText.includes('wet clean')) {
    // wet cleaning is a gentler professional alternative to dry cleaning
    if (lowerText.includes('do not')) {
      instructions.push({
        type: 'dryclean',
        instruction: 'Do not wet clean',
        iconName: 'wetclean-no'
      });
    } else {
      instructions.push({
        type: 'dryclean',
        instruction: 'Professional wet cleaning',
        iconName: 'wetclean-w'
      });
    }
  } else if (lowerText.includes('dry clean')) {
    // detect specific solvent type from the label text
    if (lowerText.includes('perchloroethylene') || lowerText.includes('tetrachloroethylene') || lowerText.includes('symbol p')) {
      instructions.push({
        type: 'dryclean',
        instruction: 'Dry clean with perchloroethylene (P)',
        iconName: 'dryclean-p'
      });
    } else if (lowerText.includes('petroleum') || lowerText.includes('symbol f')) {
      instructions.push({
        type: 'dryclean',
        instruction: 'Dry clean with petroleum solvent (F)',
        iconName: 'dryclean-f'
      });
    } else if (lowerText.includes('any solvent') || lowerText.includes('symbol a')) {
      instructions.push({
        type: 'dryclean',
        instruction: 'Dry clean with any solvent (A)',
        iconName: 'dryclean-a'
      });
    } else {
      // generic dry clean — default to P (perchloroethylene) icon as it is most common
      instructions.push({
        type: 'dryclean',
        instruction: 'Dry clean recommended',
        iconName: 'dryclean-p'
      });
    }
  }

  // ── wringing ──────────────────────────────────────────────────────────

  if (lowerText.includes('do not wring') || lowerText.includes('no wring')) {
    instructions.push({
      type: 'care',
      instruction: 'Do not wring',
      iconName: 'wring-no'
    });
  }

  // deduplicate: a label may state the same instruction twice (e.g. in multiple languages)
  // keyed by instruction text so exact duplicates are collapsed to one entry
  const uniqueInstructions = Array.from(
    new Map(instructions.map(item => [item.instruction, item])).values()
  );

  return uniqueInstructions;
};

/**
 * Calculate a preliminary sustainability score from the extracted fiber list.
 * Calls the shared impactCalculator utility.
 * Returns a default C grade (score 50) if no fibers were found.
 *
 * @param {Array<{name: string, percentage: number}>} fibers - extracted fiber list
 * @returns {{score: number, grade: string}} score 0–100 and letter grade A–F
 */
const calculateImpactFromFibers = (fibers) => {
  // no fibers detected — default to a neutral mid-point grade
  if (fibers.length === 0) {
    return { score: 50, grade: 'C' };
  }

  // delegate to the shared impact calculator (same function used by the backend)
  const { calculateImpactScore } = require('../utils/impactCalculator');
  return calculateImpactScore(fibers);
};
