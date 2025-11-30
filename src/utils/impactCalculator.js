// author: caitriona mccann
// date: 27/11/2025
// calculates environmental impact scores based on fiber composition
// assigns grades A-F based on how sustainable the fibers are

// impact data per kg of fiber: water (L), co2 (kg), biodegradable, sustainability score
const FIBER_IMPACTS = {
  // natural fibers
  Cotton: {
    waterUsage: 10000,
    co2: 1.55,
    biodegradable: true,
    biodegradabilityTime: '1-5 months',
    baseScore: 60,
  },
  'Organic Cotton': {
    waterUsage: 5000,
    co2: 1.0,
    biodegradable: true,
    biodegradabilityTime: '1-5 months',
    baseScore: 80,
  },
  Flax: {
    waterUsage: 2500,
    co2: 0.66,
    biodegradable: true,
    baseScore: 85,
  },
  Linen: {
    waterUsage: 2500,
    co2: 0.66,
    biodegradable: true,
    biodegradabilityTime: '2 weeks',
    baseScore: 85,
  },
  Jute: {
    waterUsage: 2000,
    co2: 0.67,
    biodegradable: true,
    baseScore: 82,
  },
  Hemp: {
    waterUsage: 2500,
    co2: 0.70,
    biodegradable: true,
    biodegradabilityTime: '2-8 weeks',
    baseScore: 84,
  },
  Ramie: {
    waterUsage: 2800,
    co2: 1.77,
    biodegradable: true,
    baseScore: 68,
  },
  Kenaf: {
    waterUsage: 2200,
    co2: 0.60,
    biodegradable: true,
    baseScore: 83,
  },
  Sisal: {
    waterUsage: 1800,
    co2: 0.27,
    biodegradable: true,
    baseScore: 88,
  },
  Bamboo: {
    waterUsage: 3000,
    co2: 3.90,
    biodegradable: true,
    baseScore: 55,
  },
  'Pineapple Leaf': {
    waterUsage: 2000,
    co2: 0.78,
    biodegradable: true,
    baseScore: 82,
  },
  'Banana Leaf': {
    waterUsage: 1500,
    co2: 0.40,
    biodegradable: true,
    baseScore: 86,
  },
  'Corn Husk': {
    waterUsage: 1800,
    co2: 0.74,
    biodegradable: true,
    baseScore: 83,
  },
  'Soy Protein': {
    waterUsage: 1600,
    co2: 0.35,
    biodegradable: true,
    baseScore: 87,
  },
  Nettle: {
    waterUsage: 1900,
    co2: 0.40,
    biodegradable: true,
    baseScore: 86,
  },
  Bhimal: {
    waterUsage: 2100,
    co2: 0.82,
    biodegradable: true,
    baseScore: 81,
  },
  'Sugarcane Bagasse': {
    waterUsage: 1700,
    co2: 0.68,
    biodegradable: true,
    baseScore: 84,
  },
  
  // Animal Fibers
  Wool: {
    waterUsage: 125000,
    co2: 10.4,
    biodegradable: true,
    biodegradabilityTime: '1-5 years',
    baseScore: 45,
  },
  Silk: {
    waterUsage: 3400,
    co2: 4.5,
    biodegradable: true,
    biodegradabilityTime: '1-4 years',
    baseScore: 50,
  },
  
  // Synthetic Fibers
  Polyester: {
    waterUsage: 45,
    co2: 9.52,
    biodegradable: false,
    biodegradabilityTime: '200+ years',
    baseScore: 30,
  },
  Nylon: {
    waterUsage: 250,
    co2: 7.6,
    biodegradable: false,
    biodegradabilityTime: '30-40 years',
    baseScore: 35,
  },
  Acrylic: {
    waterUsage: 132,
    co2: 8.5,
    biodegradable: false,
    baseScore: 25,
  },
  Spandex: {
    waterUsage: 120,
    co2: 9.0,
    biodegradable: false,
    baseScore: 20,
  },
  Elastane: {
    waterUsage: 120,
    co2: 9.0,
    biodegradable: false,
    baseScore: 20,
  },
  
  // Regenerated/Semi-Cellulosic Fibers
  Rayon: {
    waterUsage: 400,
    co2: 1.2,
    biodegradable: true,
    biodegradabilityTime: '5 weeks - 5 months',
    baseScore: 58,
  },
  Viscose: {
    waterUsage: 400,
    co2: 1.2,
    biodegradable: true,
    baseScore: 58,
  },
  Modal: {
    waterUsage: 350,
    co2: 0.03,
    biodegradable: true,
    baseScore: 75,
  },
  Lyocell: {
    waterUsage: 200,
    co2: 0.05,
    biodegradable: true,
    biodegradabilityTime: '4-6 weeks',
    baseScore: 80,
  },
  Tencel: {
    waterUsage: 200,
    co2: 0.05,
    biodegradable: true,
    biodegradabilityTime: '4-6 weeks',
    baseScore: 80,
  },
};

// calculate overall sustainability score from fiber mix
export const calculateImpactScore = (fibers) => {
  if (!fibers || fibers.length === 0) {
    return { score: 50, grade: 'C' }; // default middle grade
  }

  let totalScore = 0;
  let totalPercentage = 0;

  // weighted average based on fiber percentages
  fibers.forEach((fiber) => {
    const impact = FIBER_IMPACTS[fiber.name] || FIBER_IMPACTS['Cotton']; // fallback to cotton
    const weight = fiber.percentage / 100;
    totalScore += impact.baseScore * weight;
    totalPercentage += fiber.percentage;
  });

  // adjust if percentages don't add to 100
  if (totalPercentage > 0 && totalPercentage !== 100) {
    totalScore = (totalScore / totalPercentage) * 100;
  }

  const score = Math.round(totalScore);
  const grade = scoreToGrade(score);

  return { score, grade };
};

// convert score to letter grade
const scoreToGrade = (score) => {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
};

// get impact data for a specific fiber
export const getFiberImpact = (fiberName) => {
  const impact = FIBER_IMPACTS[fiberName];
  
  if (!impact) {
    return {
      waterUsage: 5000,
      co2: 5.0,
      biodegradable: false,
      biodegradabilityTime: 'Unknown',
      grade: 'C',
    };
  }

  return {
    waterUsage: impact.waterUsage,
    co2: impact.co2,
    biodegradable: impact.biodegradable,
    biodegradabilityTime: impact.biodegradabilityTime || 'Unknown',
    grade: scoreToGrade(impact.baseScore),
  };
};

// Get all available fiber types
export const getAvailableFibers = () => {
  return Object.keys(FIBER_IMPACTS).sort();
};

// Suggest more sustainable alternatives
export const suggestAlternatives = (fibers) => {
  const alternatives = [];
  
  fibers.forEach((fiber) => {
    const impact = FIBER_IMPACTS[fiber.name];
    if (impact && impact.baseScore < 70) {
      // Suggest better alternatives
      if (fiber.name === 'Cotton') {
        alternatives.push('Organic Cotton');
      } else if (fiber.name === 'Polyester') {
        alternatives.push('Recycled Polyester');
      } else if (fiber.name.toLowerCase().includes('polyester')) {
        alternatives.push('Hemp or Linen');
      }
    }
  });

  return [...new Set(alternatives)];
};


