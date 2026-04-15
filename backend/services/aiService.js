// author: caitriona mccann
// date: 10/12/2025
// last updated: 14/04/2026
// ai service for generating environmental impact summaries using ollama llm
//
// ollama runs the llama3.2:1b model locally on the proxmox server (127.0.0.1:11434).
// it receives structured scan data (grade, fibers, water/carbon metrics) and
// returns a short, user-friendly 3-4 sentence paragraph.
//
// if ollama is unavailable (timeout or error), the summaries route falls back to
// generateTemplateSummary() which produces a deterministic template-based string.
// both functions are exported so the route can choose the appropriate one.
//
// the 60-second timeout on ollama is intentionally generous - the 1B model
// may be slow on cpu-only hardware. the timeout rejects the promise so the
// route doesn't hang indefinitely.

const fetch = require('node-fetch');

// ollama connection config - defaults to localhost on the standard port
const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = process.env.OLLAMA_PORT || 11434;
const OLLAMA_URL = `http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/generate`;
const MODEL = 'llama3.2:1b'; // 1B parameter model - fast and lightweight for a home server

/**
 * Generate a 3-4 sentence AI sustainability summary for a scan using Ollama.
 * Sends a structured prompt to the local LLM and returns the generated text.
 * Throws on failure so the calling route can fall back to generateTemplateSummary().
 *
 * @param {object} scanData - scan fields from the DB or frontend
 * @param {string} scanData.grade - letter grade A-F
 * @param {number} scanData.score - 0-100 sustainability score
 * @param {string} scanData.itemType - e.g. "T-Shirt"
 * @param {Array}  scanData.fibers - [{ name, percentage }]
 * @param {number} scanData.water_usage_liters - absolute water usage for this garment
 * @param {number} scanData.carbon_footprint_kg - absolute CO2 for this garment
 * @returns {Promise<string>} the generated summary text
 */
const generateSummary = async (scanData) => {
  // destructure with fallbacks for both camelCase (frontend) and snake_case (DB) field names
  const {
    grade = 'C',
    score = 65,
    itemType = 'garment',
    item_type,          // snake_case from DB rows
    fibers = [],
    water_usage_liters = 0,
    carbon_footprint_kg = 0,
    environmental_grade,  // DB column name for grade
    environmental_score,  // DB column name for score
  } = scanData;

  // prefer DB column names if present, fall back to camelCase alternatives
  const finalGrade = environmental_grade || grade || 'C';
  const finalScore = environmental_score || score || 65;
  const finalItemType = item_type || itemType || 'garment';
  const waterUsage = parseFloat(water_usage_liters) || 0;
  const carbonFootprint = parseFloat(carbon_footprint_kg) || 0;

  // build a human-readable fiber list for the prompt, e.g. "Cotton (60%), Polyester (40%)"
  const fiberList = fibers
    .map((f) => `${f.name} (${f.percentage}%)`)
    .join(', ');

  // craft the prompt - structured data helps the model produce consistent, factual output
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

    // race the ollama request against a 60-second timeout promise
    // if ollama is slow (CPU-only server), this prevents the route from hanging
    const response = await Promise.race([
      fetch(OLLAMA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          prompt: prompt,
          stream: false,    // return complete response, not streaming tokens
          options: {
            temperature: 0.7,   // slight creativity but stays factual
            top_p: 0.9,         // nucleus sampling - filters unlikely tokens
            max_tokens: 150,    // enough for 3-4 sentences
          },
        }),
      }),
      // reject the race after 60 seconds if ollama hasn't responded
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Ollama timeout')), 60000)
      ),
    ]);

    // non-2xx status means ollama returned an error (e.g. model not loaded)
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Ollama response received');

    // the generated text is in data.response for non-streaming requests
    const summary = data.response?.trim();

    // empty response means ollama returned something unexpected
    if (!summary) {
      throw new Error('Empty response from Ollama');
    }

    return summary;
  } catch (error) {
    console.error('AI summary generation error:', error.message);
    // throw so the route handler knows to use the template fallback
    throw new Error(`AI service unavailable: ${error.message}`);
  }
};

/**
 * Template-based fallback summary used when Ollama is unavailable.
 * Produces a deterministic string from the scan data — no AI, no network call.
 * Called by the summaries route when generateSummary() throws.
 *
 * @param {object} scanData - same shape as generateSummary's input
 * @returns {string} plain-text summary paragraph
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

  // grade-specific opening sentence - sets the tone for the summary
  const gradeMessages = {
    A: 'Excellent sustainability rating!',
    B: 'Good environmental performance.',
    C: 'Moderate environmental impact.',
    D: 'Higher environmental footprint.',
    F: 'Significant environmental concerns.',
  };

  // use the first fiber as the "primary" fiber for the summary sentence
  const mainFiber = fibers[0]?.name || 'Unknown';
  const message = gradeMessages[grade] || gradeMessages.C;

  // build a single paragraph with the key metrics
  return `${message} This ${itemType} scores ${score}/100 with ${mainFiber} as the primary fiber. It requires ${water_usage_liters.toFixed(
    1
  )}L of water and produces ${carbon_footprint_kg.toFixed(
    2
  )}kg of CO₂ during production. Consider the fiber composition when making sustainable fashion choices.`;
};

/**
 * Check if the Ollama service is running and responsive.
 * Calls the /api/tags endpoint which lists available models.
 * Used by the health check route to report AI service status.
 *
 * @returns {Promise<boolean>} true if ollama is up, false otherwise
 */
const checkOllamaHealth = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${OLLAMA_PORT}/api/tags`, {
      method: 'GET',
      timeout: 5000, // fast timeout - this is a health check, not a generation request
    });
    return response.ok; // true if HTTP 200
  } catch (error) {
    console.log('Ollama health check failed:', error.message);
    return false; // any network error means ollama is not reachable
  }
};

module.exports = {
  generateSummary,
  generateTemplateSummary,
  checkOllamaHealth,
};
