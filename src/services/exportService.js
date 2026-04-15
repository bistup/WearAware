// author: caitriona mccann
// date: 30/01/2026
// last updated: 14/04/2026
// service for exporting sustainability scan history as CSV, PDF and text reports
// uses expo-file-system (legacy), expo-sharing and expo-print for Expo Go compatibility
// includes full breakdown data: fiber-level impacts, biodegradability, care instructions
//
// three export formats:
//   CSV  - tabular data for spreadsheets; one row per scan + fiber detail rows
//   TXT  - human-readable plain text report with statistics and per-scan summaries
//   PDF  - HTML-to-PDF via expo-print; styled with the WearAware colour palette
//
// all formats include:
//   - scan metadata (date, brand, item type, grade, score)
//   - garment-level metrics (water usage, carbon footprint)
//   - per-fiber breakdown (grade, water, carbon, biodegradable, biodegradability time)
//   - summary statistics (avg score, most common grade, total water/carbon)
//
// called from: ExportModal.js (in src/components/)
// exportAsPDF uses expo-print which opens the system share sheet on both iOS and Android

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { getFiberImpact } from '../utils/impactCalculator';
import { colors } from '../theme/theme';

/**
 * Build per-fiber impact breakdown data for a single scan.
 * Scales each fiber's impact rates by the garment weight and fiber percentage
 * to get absolute water and carbon contributions.
 *
 * @param {object} scan - scan object with fibers array and item_weight_grams
 * @returns {Array<{name, percentage, grade, waterUsage, carbonFootprint, biodegradable, biodegradabilityTime, rateWater, rateCo2}>}
 */
const getFiberBreakdown = (scan) => {
  // return empty array if no fiber data — the CSV/text will show N/A for this scan
  if (!scan.fibers || scan.fibers.length === 0) return [];

  // convert grams to kg for the impact rate calculation; default to 250g if weight unknown
  const weightKg = (scan.item_weight_grams || 250) / 1000;

  return scan.fibers.map((fiber) => {
    // look up per-kg impact rates for this fiber type from impactCalculator
    const impact = getFiberImpact(fiber.name);
    // fiber's contribution is proportional to its percentage in the blend
    const fiberPercentage = fiber.percentage / 100;

    return {
      name: fiber.name,
      percentage: fiber.percentage,
      grade: impact.grade,
      // absolute water usage = rate (L/kg) × garment weight (kg) × fiber fraction
      waterUsage: (impact.waterUsage * weightKg * fiberPercentage).toFixed(1),
      // absolute carbon = rate (kg CO₂/kg) × garment weight (kg) × fiber fraction
      carbonFootprint: (impact.co2 * weightKg * fiberPercentage).toFixed(3),
      biodegradable: impact.biodegradable ? 'Yes' : 'No',
      biodegradabilityTime: impact.biodegradabilityTime || 'Unknown',
      // include raw rates for the CSV "Rate" columns
      rateWater: impact.waterUsage,
      rateCo2: impact.co2,
    };
  });
};

/**
 * Convert an array of scans to a CSV string with per-fiber detail rows.
 * Each scan produces one row per fiber (scan-level fields are only filled on the first fiber row).
 * Scans with no fiber data produce a single row with N/A fiber columns.
 *
 * @param {Array} scans - array of scan objects from the history endpoint
 * @returns {string} complete CSV string including header row
 */
const generateCSV = (scans) => {
  if (!scans || scans.length === 0) {
    return 'No scans to export';
  }

  // column headers — order matches the row arrays built below
  const headers = [
    'Scan Date',
    'Brand',
    'Item Type',
    'Overall Grade',
    'Score',
    'Garment Weight (g)',
    'Total Water Usage (L)',
    'Total Carbon Footprint (kg CO2)',
    'Fiber Name',
    'Fiber Percentage',
    'Fiber Grade',
    'Fiber Water Contribution (L)',
    'Fiber CO2 Contribution (kg)',
    'Biodegradable',
    'Biodegradability Time',
    'Microplastic Shedding (mg/kg/wash)',
    'Chemical Intensity (0-100)',
    'Water Pollution (0-100)',
    'Rate (L/kg)',
    'Rate (kg CO2/kg)',
  ];

  const rows = [];

  scans.forEach((scan) => {
    const fiberBreakdown = getFiberBreakdown(scan);

    if (fiberBreakdown.length === 0) {
      // no fiber data: emit a single row with scan-level data and N/A for fiber columns
      rows.push([
        new Date(scan.createdAt).toLocaleDateString(),
        `"${scan.brand || 'Unknown'}"`,  // quote brand in case it contains commas
        scan.itemType || 'Garment',
        scan.grade || 'N/A',
        scan.score || 'N/A',
        scan.item_weight_grams || 'N/A',
        scan.water_usage_liters || '0',
        scan.carbon_footprint_kg || '0',
        'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A',
      ]);
    } else {
      // one row per fiber — scan-level columns are only populated on the first (index 0) row
      // subsequent rows leave scan columns blank to avoid visual duplication in spreadsheets
      fiberBreakdown.forEach((fiber, index) => {
        rows.push([
          index === 0 ? new Date(scan.createdAt).toLocaleDateString() : '',
          index === 0 ? `"${scan.brand || 'Unknown'}"` : '',
          index === 0 ? (scan.itemType || 'Garment') : '',
          index === 0 ? (scan.grade || 'N/A') : '',
          index === 0 ? (scan.score || 'N/A') : '',
          index === 0 ? (scan.item_weight_grams || 'N/A') : '',
          index === 0 ? (scan.water_usage_liters || '0') : '',
          index === 0 ? (scan.carbon_footprint_kg || '0') : '',
          fiber.name,
          `${fiber.percentage}%`,
          fiber.grade,
          fiber.waterUsage,
          fiber.carbonFootprint,
          fiber.biodegradable,
          fiber.biodegradabilityTime,
          // rate columns for reference — useful for comparing fibers in a spreadsheet
          fiber.rateWater,
          fiber.rateCo2,
        ]);
      });
    }
  });

  // join headers and rows into the final CSV string — newlines separate rows
  const csv = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return csv;
};

/**
 * Generate a formatted plain-text sustainability report for the given scans.
 * Includes a summary section, Ireland-specific comparisons, and per-scan
 * fiber breakdowns formatted with ASCII box-drawing characters.
 *
 * @param {Array} scans - array of scan objects
 * @returns {string} multi-line text report ready to write to a .txt file
 */
const generateTextReport = (scans) => {
  if (!scans || scans.length === 0) {
    return 'No scans to export';
  }

  // report header with generation timestamp
  let content = 'SUSTAINABILITY REPORT - WearAware\n';
  content += `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
  content += '='.repeat(80) + '\n\n';

  // ── summary statistics ────────────────────────────────────────────────
  const totalScans = scans.length;
  // sum water and carbon across all scans for the totals line
  const totalWater = scans.reduce((sum, scan) => sum + (scan.water_usage_liters || 0), 0);
  const totalCarbon = scans.reduce((sum, scan) => sum + (scan.carbon_footprint_kg || 0), 0);
  // average score gives a single headline number for the user's wardrobe
  const avgScore = scans.reduce((sum, scan) => sum + (scan.score || 0), 0) / totalScans;

  content += 'SUMMARY\n';
  content += '-'.repeat(40) + '\n';
  content += `Total Scans: ${totalScans}\n`;
  content += `Total Water Usage: ${totalWater.toFixed(2)} litres\n`;
  content += `Total Carbon Footprint: ${totalCarbon.toFixed(2)} kg CO₂\n`;
  content += `Average Sustainability Score: ${avgScore.toFixed(1)}/100\n\n`;

  // ── ireland context comparisons ───────────────────────────────────────
  // 320L = average daily household water usage in Ireland (Environmental Protection Agency)
  // 4.5 km/kg CO₂ = approximate driving equivalent for a petrol car
  // 8L = approximate volume of one cup of tea
  content += 'IRELAND CONTEXT\n';
  content += '-'.repeat(40) + '\n';
  content += `Total water footprint: ${((totalWater / 320) * 100).toFixed(1)}% of daily Irish household usage\n`;
  content += `Equivalent to ${Math.round(totalWater / 8)} cups of tea\n`;
  content += `Carbon equal to driving ${(totalCarbon * 4.5).toFixed(1)}km in a petrol car\n\n`;

  content += 'DETAILED SCANS\n';
  content += '='.repeat(80) + '\n\n';

  // ── per-scan detail blocks ────────────────────────────────────────────
  scans.forEach((scan, index) => {
    content += `SCAN ${index + 1}\n`;
    content += '-'.repeat(40) + '\n';
    content += `Date: ${new Date(scan.createdAt).toLocaleDateString()}\n`;
    content += `Brand: ${scan.brand || 'Unknown'}\n`;
    content += `Item Type: ${scan.itemType || 'Garment'}\n`;
    content += `Overall Grade: ${scan.grade || 'N/A'} (${scan.score || 'N/A'}/100)\n`;
    content += `Garment Weight: ${scan.item_weight_grams || 'N/A'}g\n`;
    content += `Total Water Usage: ${scan.water_usage_liters || '0'} litres\n`;
    content += `Total Carbon Footprint: ${scan.carbon_footprint_kg || '0'} kg CO₂\n\n`;

    // fiber breakdown with ASCII box-drawing characters for visual structure
    const fiberBreakdown = getFiberBreakdown(scan);
    if (fiberBreakdown.length > 0) {
      content += `  FIBER BREAKDOWN:\n`;
      fiberBreakdown.forEach((fiber) => {
        content += `  ┌─ ${fiber.name} (${fiber.percentage}%) - Grade ${fiber.grade}\n`;
        content += `  │  Water Contribution: ${fiber.waterUsage}L\n`;
        content += `  │  CO₂ Contribution: ${fiber.carbonFootprint}kg\n`;
        content += `  │  Biodegradable: ${fiber.biodegradable} (${fiber.biodegradabilityTime})\n`;
        // rate columns give per-kg context so users can compare fiber types
        content += `  └─ Rate: ${fiber.rateWater.toLocaleString()}L/kg, ${fiber.rateCo2}kg CO₂/kg\n\n`;
      });
    }

    content += '\n';
  });

  // ── sustainability tips ───────────────────────────────────────────────
  content += 'SUSTAINABILITY TIPS\n';
  content += '-'.repeat(40) + '\n';
  content += '• Wash in cold water (30°C) to save energy\n';
  content += '• Air dry instead of tumble drying\n';
  content += '• Repair and mend to extend garment life\n';
  content += '• Buy secondhand when possible\n';
  content += '• Donate or recycle responsibly at end of life\n';
  content += '• Choose natural fibers with lower water footprints\n';

  return content;
};

/**
 * Map a grade letter to its WearAware colour.
 * Used to colour-code grades in the PDF report.
 *
 * @param {string} grade - letter grade A through F
 * @returns {string} hex colour code from the theme
 */
const getGradeColor = (grade) => {
  switch (grade) {
    case 'A': return colors.gradeA;   // #00C96A green
    case 'B': return colors.gradeB;   // #7ED957 lime
    case 'C': return colors.gradeC;   // #FFD166 amber
    case 'D': return colors.gradeD;   // #FF9F43 orange
    case 'F': return colors.gradeF;   // #C0392B red
    default: return colors.textSecondary;
  }
};

/**
 * Generate an HTML string for the PDF sustainability report.
 * The HTML is styled inline and designed to render well via expo-print's
 * WebView-based PDF renderer (no external stylesheets).
 * Includes a summary section, Ireland context, and per-scan fiber breakdown cards.
 *
 * @param {Array} scans - array of scan objects
 * @returns {string} complete HTML document string
 */
const generatePDFHTML = (scans) => {
  if (!scans || scans.length === 0) {
    return '<html><body><h1>No scans to export</h1></body></html>';
  }

  // ── aggregate statistics for the summary section ──────────────────────
  const totalScans = scans.length;
  const totalWater = scans.reduce((sum, scan) => sum + (scan.water_usage_liters || 0), 0);
  const totalCarbon = scans.reduce((sum, scan) => sum + (scan.carbon_footprint_kg || 0), 0);
  const avgScore = scans.reduce((sum, scan) => sum + (scan.score || 0), 0) / totalScans;

  // count how many scans of each grade the user has for the distribution row
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scans.forEach((scan) => {
    const grade = scan.grade || 'F';
    if (gradeDistribution[grade] !== undefined) {
      gradeDistribution[grade]++;
    }
  });

  // ── HTML document with inline styles ─────────────────────────────────
  // using inline styles throughout to avoid external stylesheet dependency
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>WearAware Sustainability Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #333; font-size: 12px; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #27ae60; }
    .header h1 { color: #27ae60; font-size: 24px; margin-bottom: 5px; }
    .header .date { color: #666; font-size: 11px; }
    .summary { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 25px; }
    .summary h2 { color: #27ae60; font-size: 16px; margin-bottom: 15px; }
    .stats-grid { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; }
    .stat-box { flex: 1; min-width: 100px; background: white; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e0e0e0; }
    .stat-value { font-size: 20px; font-weight: 700; color: #27ae60; }
    .stat-label { font-size: 10px; color: #666; margin-top: 4px; }
    .grade-dist { display: flex; justify-content: space-around; margin-top: 15px; }
    .grade-item { text-align: center; }
    .grade-letter { font-size: 18px; font-weight: 700; }
    .grade-count { font-size: 11px; color: #666; }
    .ireland-context { background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
    .ireland-context h3 { color: #27ae60; font-size: 14px; margin-bottom: 10px; }
    .ireland-context p { font-size: 11px; color: #333; line-height: 1.6; }
    .scan-card { background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; }
    .scan-header { background: #f5f5f5; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e0e0e0; }
    .scan-title { font-weight: 600; font-size: 14px; }
    .scan-grade { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px; }
    .scan-body { padding: 15px; }
    .scan-meta { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px; }
    .meta-item { font-size: 11px; }
    .meta-label { color: #666; }
    .meta-value { font-weight: 600; color: #333; }
    .impact-row { display: flex; gap: 15px; margin-bottom: 15px; }
    .impact-box { flex: 1; background: #f9f9f9; padding: 10px; border-radius: 6px; text-align: center; }
    .impact-value { font-size: 16px; font-weight: 700; color: #27ae60; }
    .impact-label { font-size: 10px; color: #666; margin-top: 3px; }
    .fiber-section { margin-top: 15px; }
    .fiber-section h4 { font-size: 12px; color: #333; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e0e0e0; }
    .fiber-item { background: #fafafa; padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #27ae60; }
    .fiber-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .fiber-name { font-weight: 600; font-size: 12px; }
    .fiber-grade { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; color: white; }
    .fiber-details { display: flex; flex-wrap: wrap; gap: 10px; }
    .fiber-detail { font-size: 10px; }
    .fiber-detail span { color: #666; }
    .tips { background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 25px; }
    .tips h3 { color: #e65100; font-size: 14px; margin-bottom: 10px; }
    .tips ul { padding-left: 20px; }
    .tips li { font-size: 11px; color: #333; margin-bottom: 5px; line-height: 1.5; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>WearAware Sustainability Report</h1>
    <p class="date">Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>

  <div class="summary">
    <h2>Report Summary</h2>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${totalScans}</div>
        <div class="stat-label">Total Scans</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${avgScore.toFixed(0)}</div>
        <div class="stat-label">Avg Score</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${totalWater.toFixed(1)}L</div>
        <div class="stat-label">Water Usage</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${totalCarbon.toFixed(2)}kg</div>
        <div class="stat-label">CO₂ Footprint</div>
      </div>
    </div>
    <!-- grade distribution row: shows how many items of each grade the user has -->
    <div class="grade-dist">
      ${Object.entries(gradeDistribution).map(([grade, count]) => `
        <div class="grade-item">
          <div class="grade-letter" style="color: ${getGradeColor(grade)}">${grade}</div>
          <div class="grade-count">${count} items</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- ireland context block: puts the user's total impact into relatable local terms -->
  <div class="ireland-context">
    <h3>Ireland Context</h3>
    <p>
      <strong>Water footprint:</strong> ${((totalWater / 320) * 100).toFixed(1)}% of average daily Irish household usage (320L)<br>
      <strong>Equivalent to:</strong> ${Math.round(totalWater / 8)} cups of tea<br>
      <strong>Carbon impact:</strong> Equal to driving ${(totalCarbon * 4.5).toFixed(1)}km in a petrol car
    </p>
  </div>

  <h2 style="color: #27ae60; font-size: 16px; margin-bottom: 15px;">Detailed Scans</h2>
`;

  // ── one card per scan ─────────────────────────────────────────────────
  scans.forEach((scan) => {
    const fiberBreakdown = getFiberBreakdown(scan);
    // grade colour is used for the circular grade badge on each card
    const gradeColor = getGradeColor(scan.grade || 'C');

    // scan card header: brand/type name + colour-coded grade badge
    html += `
  <div class="scan-card">
    <div class="scan-header">
      <div class="scan-title">${scan.brand || 'Unknown Brand'} - ${scan.itemType || 'Garment'}</div>
      <div class="scan-grade" style="background: ${gradeColor}">${scan.grade || 'C'}</div>
    </div>
    <div class="scan-body">
      <div class="scan-meta">
        <div class="meta-item"><span class="meta-label">Date:</span> <span class="meta-value">${new Date(scan.createdAt).toLocaleDateString()}</span></div>
        <div class="meta-item"><span class="meta-label">Score:</span> <span class="meta-value">${scan.score || 'N/A'}/100</span></div>
        <div class="meta-item"><span class="meta-label">Weight:</span> <span class="meta-value">${scan.item_weight_grams || 'N/A'}g</span></div>
      </div>

      <!-- impact boxes: total water and carbon for this garment -->
      <div class="impact-row">
        <div class="impact-box">
          <div class="impact-value">${scan.water_usage_liters ? scan.water_usage_liters.toFixed(1) : '0'}L</div>
          <div class="impact-label">Water Usage</div>
        </div>
        <div class="impact-box">
          <div class="impact-value">${scan.carbon_footprint_kg ? scan.carbon_footprint_kg.toFixed(2) : '0'}kg</div>
          <div class="impact-label">CO₂ Footprint</div>
        </div>
      </div>
`;

    // fiber breakdown section — only rendered if the scan has fiber data
    if (fiberBreakdown.length > 0) {
      html += `
      <div class="fiber-section">
        <h4>Fiber Composition &amp; Impact</h4>
`;
      fiberBreakdown.forEach((fiber) => {
        // left border colour matches the fiber's individual grade
        html += `
        <div class="fiber-item" style="border-left-color: ${getGradeColor(fiber.grade)}">
          <div class="fiber-header">
            <span class="fiber-name">${fiber.name} (${fiber.percentage}%)</span>
            <span class="fiber-grade" style="background: ${getGradeColor(fiber.grade)}">Grade ${fiber.grade}</span>
          </div>
          <div class="fiber-details">
            <div class="fiber-detail"><span>Water:</span> ${fiber.waterUsage}L</div>
            <div class="fiber-detail"><span>CO₂:</span> ${fiber.carbonFootprint}kg</div>
            <div class="fiber-detail"><span>Biodegradable:</span> ${fiber.biodegradable}</div>
            <div class="fiber-detail"><span>Biodegrade time:</span> ${fiber.biodegradabilityTime}</div>
          </div>
        </div>
`;
      });
      html += `      </div>`;  // close fiber-section
    }

    html += `
    </div>
  </div>
`;
  });

  // ── sustainability tips and footer ────────────────────────────────────
  html += `
  <div class="tips">
    <h3>Sustainability Tips</h3>
    <ul>
      <li>Wash in cold water (30°C) to save energy</li>
      <li>Air dry instead of tumble drying</li>
      <li>Repair and mend to extend garment life</li>
      <li>Buy secondhand when possible</li>
      <li>Donate or recycle responsibly at end of life</li>
      <li>Choose natural fibers with lower water footprints</li>
    </ul>
  </div>

  <div class="footer">
    <p>Generated by WearAware • Making fashion sustainable, one scan at a time</p>
  </div>
</body>
</html>
`;

  return html;
};

/**
 * Export scan history as a PDF file and open the system share sheet.
 * Uses expo-print to convert the HTML report to a temporary PDF file,
 * then expo-sharing to present the system share dialog.
 *
 * @param {Array} scans - array of scan objects to include in the report
 * @returns {Promise<boolean>} true if the share sheet was opened successfully
 * @throws if expo-print fails or sharing is not available on the device
 */
export const exportAsPDF = async (scans) => {
  try {
    // generate the full HTML document for the report
    const htmlContent = generatePDFHTML(scans);

    // expo-print renders the HTML in a headless WebView and saves the result as a PDF
    // base64: false means we get a file:// URI rather than a base64 string
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // check that the device supports sharing (some emulators don't)
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      // open the system share sheet with the PDF file
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export Sustainability Report',
        UTI: 'com.adobe.pdf',  // UTI is required on iOS for the correct icon/handler
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }

    return true;
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;  // re-throw so ExportModal can show an error alert
  }
};

/**
 * Export scan history as a CSV file and open the system share sheet.
 * Writes the CSV to the app's document directory as a temporary file,
 * then opens the share sheet so the user can save or send it.
 *
 * @param {Array} scans - array of scan objects to include
 * @param {string} [filename='sustainability-report.csv'] - output filename
 * @returns {Promise<boolean>} true if the share sheet was opened successfully
 * @throws if file write or sharing fails
 */
export const exportAsCSV = async (scans, filename = 'sustainability-report.csv') => {
  try {
    // generate the CSV content string
    const csvContent = generateCSV(scans);
    // write to app's document directory (accessible to the share sheet)
    const filePath = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filePath, csvContent, {
      encoding: 'utf8',
    });

    // open the share sheet so the user can save to Files, email, etc.
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Sustainability Report',
        UTI: 'public.comma-separated-values-text',  // iOS UTI for CSV files
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }

    return true;
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw error;
  }
};

/**
 * Export scan history as a plain-text file and open the system share sheet.
 * Writes the formatted text report to the app's document directory,
 * then opens the share sheet.
 *
 * @param {Array} scans - array of scan objects to include
 * @param {string} [filename='sustainability-report.txt'] - output filename
 * @returns {Promise<boolean>} true if the share sheet was opened successfully
 * @throws if file write or sharing fails
 */
export const exportAsText = async (scans, filename = 'sustainability-report.txt') => {
  try {
    // generate the text report content
    const textContent = generateTextReport(scans);
    const filePath = `${FileSystem.documentDirectory}${filename}`;

    // write the text report to a file in the document directory
    await FileSystem.writeAsStringAsync(filePath, textContent, {
      encoding: 'utf8',
    });

    // open the share sheet
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/plain',
        dialogTitle: 'Export Sustainability Report',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }

    return true;
  } catch (error) {
    console.error('Error exporting text:', error);
    throw error;
  }
};

/**
 * Calculate aggregate statistics across all scans.
 * Returns totals, averages, and grade distribution for display in the history screen header.
 * Returns a zeroed object if the scans array is empty.
 *
 * @param {Array} scans - array of scan objects
 * @returns {{totalScans, totalWater, totalCarbon, averageGrade, averageScore, gradeDistribution}}
 */
export const generateStatistics = (scans) => {
  // return a safe default object when there are no scans to avoid division by zero
  if (!scans || scans.length === 0) {
    return {
      totalScans: 0,
      totalWater: 0,
      totalCarbon: 0,
      averageGrade: 'N/A',
      averageScore: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
    };
  }

  // sum water and carbon totals across all scans
  const totalWater = scans.reduce((sum, scan) => sum + (scan.water_usage_liters || 0), 0);
  const totalCarbon = scans.reduce((sum, scan) => sum + (scan.carbon_footprint_kg || 0), 0);
  const averageScore = scans.reduce((sum, scan) => sum + (scan.score || 0), 0) / scans.length;

  // map the numeric average score to a letter grade using the standard thresholds
  let averageGrade = 'F';
  if (averageScore >= 80) averageGrade = 'A';
  else if (averageScore >= 65) averageGrade = 'B';
  else if (averageScore >= 50) averageGrade = 'C';
  else if (averageScore >= 35) averageGrade = 'D';

  // count how many scans received each grade for the distribution display
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scans.forEach((scan) => {
    const grade = scan.grade || 'F';
    if (gradeDistribution[grade] !== undefined) {
      gradeDistribution[grade]++;
    }
  });

  return {
    totalScans: scans.length,
    // round to 2 decimal places to avoid floating-point noise in the display
    totalWater: Math.round(totalWater * 100) / 100,
    totalCarbon: Math.round(totalCarbon * 100) / 100,
    averageGrade,
    averageScore: Math.round(averageScore),
    gradeDistribution,
  };
};
