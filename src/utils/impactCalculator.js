// author: caitriona mccann
// date: 27/11/2025
// last updated: 30/01/2026
// calculates environmental impact scores based on fiber composition
// assigns grades A-F based on how sustainable the fibers are
// uPDATED: Research-based data including microplastic shedding, chemical treatments, 
// renewable energy usage, and water pollution factors

// impact data per kg of fiber: water (L), co2 (kg), biodegradable, sustainability score
// microplasticShedding: mg per kg of fabric per wash
// chemicalIntensity: 0-100 scale (higher = more harmful chemicals)
// renewableEnergyPotential: 0-100 scale (higher = more renewable in production)
// waterPollution: 0-100 scale (higher = more pollutants released)
const FIBER_IMPACTS = {
  // natural fibers
  Cotton: {
    waterUsage: 10000,
    co2: 1.55,
    biodegradable: true,
    biodegradabilityTime: '1-5 months',
    baseScore: 60,
    microplasticShedding: 0,
    chemicalIntensity: 65, // pesticides, fertilizers
    renewableEnergyPotential: 40,
    waterPollution: 60, // pesticide runoff
  },
  'Organic Cotton': {
    waterUsage: 5000,
    co2: 1.0,
    biodegradable: true,
    biodegradabilityTime: '1-5 months',
    baseScore: 80,
    microplasticShedding: 0,
    chemicalIntensity: 15, // minimal pesticides
    renewableEnergyPotential: 60,
    waterPollution: 20,
  },
  Flax: {
    waterUsage: 2500,
    co2: 0.66,
    biodegradable: true,
    baseScore: 85,
    microplasticShedding: 0,
    chemicalIntensity: 10,
    renewableEnergyPotential: 75,
    waterPollution: 15,
  },
  Linen: {
    waterUsage: 2500,
    co2: 0.66,
    biodegradable: true,
    biodegradabilityTime: '2 weeks',
    baseScore: 85,
    microplasticShedding: 0,
    chemicalIntensity: 10,
    renewableEnergyPotential: 75,
    waterPollution: 15,
  },
  Jute: {
    waterUsage: 2000,
    co2: 0.67,
    biodegradable: true,
    baseScore: 82,
    microplasticShedding: 0,
    chemicalIntensity: 12,
    renewableEnergyPotential: 70,
    waterPollution: 18,
  },
  Hemp: {
    waterUsage: 2500,
    co2: 0.70,
    biodegradable: true,
    biodegradabilityTime: '2-8 weeks',
    baseScore: 84,
    microplasticShedding: 0,
    chemicalIntensity: 8,
    renewableEnergyPotential: 80,
    waterPollution: 10,
  },
  Ramie: {
    waterUsage: 2800,
    co2: 1.77,
    biodegradable: true,
    baseScore: 68,
    microplasticShedding: 0,
    chemicalIntensity: 30,
    renewableEnergyPotential: 55,
    waterPollution: 35,
  },
  Kenaf: {
    waterUsage: 2200,
    co2: 0.60,
    biodegradable: true,
    baseScore: 83,
    microplasticShedding: 0,
    chemicalIntensity: 10,
    renewableEnergyPotential: 75,
    waterPollution: 15,
  },
  Sisal: {
    waterUsage: 1800,
    co2: 0.27,
    biodegradable: true,
    baseScore: 88,
    microplasticShedding: 0,
    chemicalIntensity: 5,
    renewableEnergyPotential: 85,
    waterPollution: 8,
  },
  Bamboo: {
    waterUsage: 3000,
    co2: 3.90,
    biodegradable: true,
    baseScore: 55,
    microplasticShedding: 0,
    chemicalIntensity: 50, // often chemically processed
    renewableEnergyPotential: 65,
    waterPollution: 45,
  },
  'Pineapple Leaf': {
    waterUsage: 2000,
    co2: 0.78,
    biodegradable: true,
    baseScore: 82,
    microplasticShedding: 0,
    chemicalIntensity: 15,
    renewableEnergyPotential: 70,
    waterPollution: 20,
  },
  'Banana Leaf': {
    waterUsage: 1500,
    co2: 0.40,
    biodegradable: true,
    baseScore: 86,
    microplasticShedding: 0,
    chemicalIntensity: 10,
    renewableEnergyPotential: 80,
    waterPollution: 12,
  },
  'Corn Husk': {
    waterUsage: 1800,
    co2: 0.74,
    biodegradable: true,
    baseScore: 83,
    microplasticShedding: 0,
    chemicalIntensity: 18,
    renewableEnergyPotential: 72,
    waterPollution: 22,
  },
  'Soy Protein': {
    waterUsage: 1600,
    co2: 0.35,
    biodegradable: true,
    baseScore: 87,
    microplasticShedding: 0,
    chemicalIntensity: 12,
    renewableEnergyPotential: 78,
    waterPollution: 15,
  },
  Nettle: {
    waterUsage: 1900,
    co2: 0.40,
    biodegradable: true,
    baseScore: 86,
    microplasticShedding: 0,
    chemicalIntensity: 8,
    renewableEnergyPotential: 82,
    waterPollution: 10,
  },
  Bhimal: {
    waterUsage: 2100,
    co2: 0.82,
    biodegradable: true,
    baseScore: 81,
    microplasticShedding: 0,
    chemicalIntensity: 20,
    renewableEnergyPotential: 68,
    waterPollution: 25,
  },
  'Sugarcane Bagasse': {
    waterUsage: 1700,
    co2: 0.68,
    biodegradable: true,
    baseScore: 84,
    microplasticShedding: 0,
    chemicalIntensity: 15,
    renewableEnergyPotential: 75,
    waterPollution: 18,
  },
  
  // animal Fibers
  Wool: {
    waterUsage: 125000,
    co2: 10.4,
    biodegradable: true,
    biodegradabilityTime: '1-5 years',
    baseScore: 45,
    microplasticShedding: 0,
    chemicalIntensity: 55, // sheep dips, cleaning chemicals
    renewableEnergyPotential: 30,
    waterPollution: 70, // methane, manure runoff
  },
  Silk: {
    waterUsage: 3400,
    co2: 4.5,
    biodegradable: true,
    biodegradabilityTime: '1-4 years',
    baseScore: 50,
    microplasticShedding: 0,
    chemicalIntensity: 40,
    renewableEnergyPotential: 45,
    waterPollution: 50,
  },
  
  // synthetic Fibers
  Polyester: {
    waterUsage: 45,
    co2: 9.52,
    biodegradable: false,
    biodegradabilityTime: '200+ years',
    baseScore: 30,
    microplasticShedding: 1900, // mg per kg per wash - significant contributor
    chemicalIntensity: 85,
    renewableEnergyPotential: 5,
    waterPollution: 90,
  },
  Nylon: {
    waterUsage: 250,
    co2: 7.6,
    biodegradable: false,
    biodegradabilityTime: '30-40 years',
    baseScore: 35,
    microplasticShedding: 1600,
    chemicalIntensity: 80,
    renewableEnergyPotential: 8,
    waterPollution: 85,
  },
  Acrylic: {
    waterUsage: 132,
    co2: 8.5,
    biodegradable: false,
    baseScore: 25,
    microplasticShedding: 2200, // highest microplastic shedding
    chemicalIntensity: 90,
    renewableEnergyPotential: 3,
    waterPollution: 95,
  },
  Spandex: {
    waterUsage: 120,
    co2: 9.0,
    biodegradable: false,
    baseScore: 20,
    microplasticShedding: 1800,
    chemicalIntensity: 92,
    renewableEnergyPotential: 2,
    waterPollution: 92,
  },
  Elastane: {
    waterUsage: 120,
    co2: 9.0,
    biodegradable: false,
    baseScore: 20,
    microplasticShedding: 1800,
    chemicalIntensity: 92,
    renewableEnergyPotential: 2,
    waterPollution: 92,
  },
  
  // regenerated/Semi-Cellulosic Fibers
  Rayon: {
    waterUsage: 400,
    co2: 1.2,
    biodegradable: true,
    biodegradabilityTime: '5 weeks - 5 months',
    baseScore: 58,
    microplasticShedding: 0,
    chemicalIntensity: 70, // harsh chemical processing
    renewableEnergyPotential: 35,
    waterPollution: 65,
  },
  Viscose: {
    waterUsage: 400,
    co2: 1.2,
    biodegradable: true,
    baseScore: 58,
    microplasticShedding: 0,
    chemicalIntensity: 70,
    renewableEnergyPotential: 35,
    waterPollution: 65,
  },
  Modal: {
    waterUsage: 350,
    co2: 0.03,
    biodegradable: true,
    baseScore: 75,
    microplasticShedding: 0,
    chemicalIntensity: 30, // closed-loop system
    renewableEnergyPotential: 70,
    waterPollution: 25,
  },
  Lyocell: {
    waterUsage: 200,
    co2: 0.05,
    biodegradable: true,
    biodegradabilityTime: '4-6 weeks',
    baseScore: 80,
    microplasticShedding: 0,
    chemicalIntensity: 15, // non-toxic closed-loop solvent
    renewableEnergyPotential: 85,
    waterPollution: 12,
  },
  Tencel: {
    waterUsage: 200,
    co2: 0.05,
    biodegradable: true,
    biodegradabilityTime: '4-6 weeks',
    baseScore: 80,
    microplasticShedding: 0,
    chemicalIntensity: 15,
    renewableEnergyPotential: 85,
    waterPollution: 12,
  },
};

// calculate overall sustainability score from fiber mix
export const calculateImpactScore = (fibers, weightGrams = 300) => {
  if (!fibers || fibers.length === 0) {
    return { score: 50, grade: 'C', waterUsage: 0, carbonFootprint: 0 }; // default middle grade
  }

  let totalScore = 0;
  let totalPercentage = 0;
  let totalWater = 0;
  let totalCarbon = 0;
  let totalMicroplastics = 0;
  let totalChemicalImpact = 0;
  let totalRenewableEnergy = 0;
  let totalWaterPollution = 0;
  
  const weightKg = weightGrams / 1000;

  // weighted average based on fiber percentages
  fibers.forEach((fiber) => {
    const impact = FIBER_IMPACTS[fiber.name] || FIBER_IMPACTS['Cotton']; // fallback to cotton
    const weight = fiber.percentage / 100;
    totalScore += impact.baseScore * weight;
    totalPercentage += fiber.percentage;
    
    // calculate water and carbon for this fiber
    totalWater += impact.waterUsage * weightKg * weight;
    totalCarbon += impact.co2 * weightKg * weight;
    
    // accumulate enhanced metrics
    totalMicroplastics += (impact.microplasticShedding || 0) * weightKg * weight;
    totalChemicalImpact += (impact.chemicalIntensity || 0) * weight;
    totalRenewableEnergy += (impact.renewableEnergyPotential || 0) * weight;
    totalWaterPollution += (impact.waterPollution || 0) * weight;
  });

  // adjust if percentages don't add to 100
  if (totalPercentage > 0 && totalPercentage !== 100) {
    totalScore = (totalScore / totalPercentage) * 100;
  }

  // apply penalty/bonus based on enhanced metrics
  // microplastics penalty: reduce score for synthetic materials
  if (totalMicroplastics > 1000) {
    totalScore -= 5;
  } else if (totalMicroplastics > 500) {
    totalScore -= 3;
  }

  // chemical intensity penalty
  if (totalChemicalImpact > 70) {
    totalScore -= 4;
  } else if (totalChemicalImpact > 50) {
    totalScore -= 2;
  }

  // renewable energy bonus
  if (totalRenewableEnergy > 70) {
    totalScore += 3;
  } else if (totalRenewableEnergy > 50) {
    totalScore += 1;
  }

  // water pollution penalty
  if (totalWaterPollution > 70) {
    totalScore -= 3;
  } else if (totalWaterPollution > 50) {
    totalScore -= 1;
  }

  // ensure score stays within bounds
  totalScore = Math.max(0, Math.min(100, totalScore));

  const score = Math.round(totalScore);
  const grade = scoreToGrade(score);
  const waterUsage = Math.round(totalWater * 100) / 100;
  const carbonFootprint = Math.round(totalCarbon * 100) / 100;
  const microplasticShedding = Math.round(totalMicroplastics * 100) / 100;

  return { 
    score, 
    grade, 
    waterUsage, 
    carbonFootprint,
    microplasticShedding,
    chemicalImpact: Math.round(totalChemicalImpact),
    renewableEnergy: Math.round(totalRenewableEnergy),
    waterPollution: Math.round(totalWaterPollution),
  };
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

// get all available fiber types
export const getAvailableFibers = () => {
  return Object.keys(FIBER_IMPACTS).sort();
};

// suggest more sustainable alternatives
export const suggestAlternatives = (fibers) => {
  const alternatives = [];
  
  fibers.forEach((fiber) => {
    const impact = FIBER_IMPACTS[fiber.name];
    if (impact && impact.baseScore < 70) {
      // suggest better alternatives
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

// get detailed environmental impact breakdown for display
export const getDetailedImpact = (fibers, weightGrams = 300) => {
  const impact = calculateImpactScore(fibers, weightGrams);
  
  return {
    overall: {
      score: impact.score,
      grade: impact.grade,
    },
    resource: {
      waterUsage: impact.waterUsage,
      carbonFootprint: impact.carbonFootprint,
    },
    pollution: {
      microplasticShedding: impact.microplasticShedding || 0,
      waterPollution: impact.waterPollution || 0,
      chemicalImpact: impact.chemicalImpact || 0,
    },
    production: {
      renewableEnergy: impact.renewableEnergy || 0,
    },
    sustainability: {
      biodegradable: fibers.every(f => FIBER_IMPACTS[f.name]?.biodegradable),
      alternatives: suggestAlternatives(fibers),
    },
  };
};

// calculate washing impact (microplastic release over garment lifetime)
export const calculateWashingImpact = (fibers, weightGrams = 300, estimatedWashes = 50) => {
  const weightKg = weightGrams / 1000;
  let totalMicroplastics = 0;

  fibers.forEach((fiber) => {
    const impact = FIBER_IMPACTS[fiber.name] || FIBER_IMPACTS['Cotton'];
    const weight = fiber.percentage / 100;
    totalMicroplastics += (impact.microplasticShedding || 0) * weightKg * weight;
  });

  // total microplastics over lifetime
  const lifetimeMicroplastics = totalMicroplastics * estimatedWashes;

  return {
    perWash: Math.round(totalMicroplastics * 100) / 100,
    lifetime: Math.round(lifetimeMicroplastics * 100) / 100,
    estimatedWashes,
  };
};
