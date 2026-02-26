// author: caitriona mccann
// date: 27/11/2025
// connects to google cloud vision api to read text from clothing labels
// extracts fiber composition and country of origin from the scanned images

// loaded from .env via react-native-dotenv
import { GOOGLE_VISION_API_KEY } from '@env';
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
            {
              type: 'LABEL_DETECTION',
              maxResults: 10,
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
    
    // only add if percentage is reasonable (1-100)
    if (percentage > 0 && percentage <= 100) {
      if (!processedFibers.has(fiberName)) {
        processedFibers.set(fiberName, percentage);
      }
    }
  }

  // convert map to array
  processedFibers.forEach((percentage, name) => {
    fibers.push({ name, percentage });
  });

  // normalize percentages if they don't add up to 100
  const total = fibers.reduce((sum, f) => sum + f.percentage, 0);
  if (total > 0 && total !== 100) {
    fibers.forEach(f => {
      f.percentage = Math.round((f.percentage / total) * 100);
    });
  }

  // extract brand - look for brand indicators or use first clean line
  const brand = extractBrand(lines);

  // extract "Made in" information
  const madeIn = extractMadeIn(text);

  // determine item type (simple heuristic)
  const itemType = detectItemType(text);

  // extract care instructions from symbols and text
  const careInstructions = extractCareInstructions(text);

  // calculate environmental score
  const { score, grade } = calculateImpactFromFibers(fibers);

  return {
    brand,
    itemType,
    madeIn,
    fibers,
    score,
    grade,
    careInstructions,
    rawText: text,
    scanType: 'camera',
  };
};

const extractBrand = (lines) => {
  // filter out lines that are likely not brand names
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
    // skip empty or very short lines
    if (line.length < 2 || line.length > 40) continue;
    
    // skip if matches exclude patterns
    if (excludePatterns.some(pattern => pattern.test(line))) continue;
    
    // this is likely the brand
    return line;
  }

  return 'Unknown Brand';
};

const extractMadeIn = (text) => {
  // try to find "Made in [Country]" patterns
  const madeInRegex = /made\s+in\s+([a-z\s]+?)(?:\n|$|[,.]|\s+\d|\s+rn|\s+ca)/i;
  const match = text.match(madeInRegex);
  
  if (match && match[1]) {
    // clean up the country name
    const country = match[1].trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // validate it's a reasonable country name (not too long, no numbers)
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

const extractCareInstructions = (text) => {
  const lowerText = text.toLowerCase();
  const instructions = [];

  // temperature detection from text
  const tempMatch = text.match(/(\d+)[°º]?\s*[CF]?/g);
  const temperatures = tempMatch ? tempMatch.map(t => parseInt(t)) : [];

  // washing instructions with detailed temperature mapping
  if (lowerText.includes('machine wash') || lowerText.includes('wash with')) {
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

  // bleaching
  if (lowerText.includes('do not bleach') || lowerText.includes('no bleach')) {
    instructions.push({ 
      type: 'bleach', 
      instruction: 'Do not bleach', 
      iconName: 'bleach-no'
    });
  } else if (lowerText.includes('bleach')) {
    if (lowerText.includes('non-chlorine') || lowerText.includes('oxygen')) {
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

  // drying - Tumble dry
  if (lowerText.includes('tumble dry')) {
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

  // ironing with temperature detection
  if (lowerText.includes('iron')) {
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
      instructions.push({ 
        type: 'iron', 
        instruction: 'Iron if needed', 
        iconName: 'iron'
      });
    }
  }

  // dry cleaning
  if (lowerText.includes('do not dry clean')) {
    instructions.push({ 
      type: 'dryclean', 
      instruction: 'Do not dry clean', 
      iconName: 'dryclean-no'
    });
  } else if (lowerText.includes('wet clean')) {
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
    // detect solvent types
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
      instructions.push({ 
        type: 'dryclean', 
        instruction: 'Dry clean recommended', 
        iconName: 'dryclean-p'
      });
    }
  }

  // wringing
  if (lowerText.includes('do not wring') || lowerText.includes('no wring')) {
    instructions.push({ 
      type: 'care', 
      instruction: 'Do not wring', 
      iconName: 'wring-no'
    });
  }

  // remove duplicates based on instruction text
  const uniqueInstructions = Array.from(
    new Map(instructions.map(item => [item.instruction, item])).values()
  );

  return uniqueInstructions;
};

const calculateImpactFromFibers = (fibers) => {
  if (fibers.length === 0) {
    return { score: 50, grade: 'C' };
  }

  // import impact calculator
  const { calculateImpactScore } = require('../utils/impactCalculator');
  return calculateImpactScore(fibers);
};


