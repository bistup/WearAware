// author: caitriona mccann
// date: 10/12/2025
// ai service for generating environmental impact summaries using ollama llm

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = process.env.OLLAMA_PORT || 11434;
const OLLAMA_URL = `http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/generate`;
const MODEL = 'llama3.2:1b'; // 1B parameter model - fast and lightweight

/**
 * Generate AI summary for a scan using Ollama LLM
 * @param {object} scanData - Scan data with grade, fibers, metrics
 * @returns {Promise<string>} 3-4 line AI-generated summary
 */
const generateSummary = async (scanData) => {
  const {
    grade = 'C',
    score = 65,
    itemType = 'garment',
    item_type,
    fibers = [],
    water_usage_liters = 0,
    carbon_footprint_kg = 0,
    environmental_grade,
    environmental_score,
  } = scanData;

  // handle both camelCase (frontend) and snake_case (database) field names
  const finalGrade = environmental_grade || grade || 'C';
  const finalScore = environmental_score || score || 65;
  const finalItemType = item_type || itemType || 'garment';
  const waterUsage = parseFloat(water_usage_liters) || 0;
  const carbonFootprint = parseFloat(carbon_footprint_kg) || 0;

  // build fiber description
  const fiberList = fibers
    .map((f) => `${f.name} (${f.percentage}%)`)
    .join(', ');

  // craft prompt for the LLM
  const prompt = `You are an environmental sustainability expert analyzing clothing impact.

Garment: ${finalItemType}
Sustainability Grade: ${finalGrade} (${finalScore}/100)
Fiber Composition: ${fiberList}
Water Usage: ${waterUsage.toFixed(1)}L
Carbon Footprint: ${carbonFootprint.toFixed(2)}kg CO₂

Generate a concise 3-4 sentence summary that:
1. States the overall environmental grade and what it means
2. Highlights the main fiber(s) and their sustainability impact
3. Mentions the water and carbon metrics in context
4. Provides one actionable insight or recommendation

Keep it educational, positive, and under 100 words. Do not use bullet points.`;

  try {
    console.log('Calling Ollama for summary generation...');
    
    const response = await Promise.race([
      fetch(OLLAMA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 150,
          },
        }),
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Ollama timeout')), 15000)
      ),
    ]);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Ollama response received');
    const summary = data.response?.trim();

    if (!summary) {
      throw new Error('Empty response from Ollama');
    }

    return summary;
  } catch (error) {
    console.error('AI summary generation error:', error.message);
    // throw error instead of falling back to template
    throw new Error(`AI service unavailable: ${error.message}`);
  }
};

/**
 * Template-based fallback summary (used when Ollama unavailable)
 * @param {object} scanData - Scan data
 * @returns {string} Template-based summary
 */
const generateTemplateSummary = (scanData) => {
  const {
    grade = 'C',
    score = 65,
    itemType = 'garment',
    fibers = [],
    water_usage_liters = 0,
    carbon_footprint_kg = 0,
  } = scanData;

  const gradeMessages = {
    A: 'Excellent sustainability rating!',
    B: 'Good environmental performance.',
    C: 'Moderate environmental impact.',
    D: 'Higher environmental footprint.',
    F: 'Significant environmental concerns.',
  };

  const mainFiber = fibers[0]?.name || 'Unknown';
  const message = gradeMessages[grade] || gradeMessages.C;

  return `${message} This ${itemType} scores ${score}/100 with ${mainFiber} as the primary fiber. It requires ${water_usage_liters.toFixed(
    1
  )}L of water and produces ${carbon_footprint_kg.toFixed(
    2
  )}kg of CO₂ during production. Consider the fiber composition when making sustainable fashion choices.`;
};

/**
 * Check if Ollama service is available
 * @returns {Promise<boolean>}
 */
const checkOllamaHealth = async () => {
  try {
    const response = await fetch(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    console.log('Ollama health check failed:', error.message);
    return false;
  }
};

module.exports = {
  generateSummary,
  generateTemplateSummary,
  checkOllamaHealth,
};
