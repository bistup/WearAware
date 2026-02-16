// author: caitriona mccann
// date: 30/01/2026
// last updated: 05/02/2026
// service for exporting sustainability scan history as CSV, PDF and text reports
// uses expo-file-system (legacy), expo-sharing and expo-print for Expo Go compatibility
// includes full breakdown data: fiber-level impacts, biodegradability, microplastics, care instructions

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { getFiberImpact } from '../utils/impactCalculator';
import { colors } from '../theme/theme';

/**
 * Get fiber-level breakdown data for a scan
 * @param {Object} scan - Scan object with fibers and item_weight_grams
 * @returns {Array} Array of fiber breakdown objects
 */
const getFiberBreakdown = (scan) => {
  if (!scan.fibers || scan.fibers.length === 0) return [];
  
  const weightKg = (scan.item_weight_grams || 250) / 1000; // default 250g if not set
  
  return scan.fibers.map((fiber) => {
    const impact = getFiberImpact(fiber.name);
    const fiberPercentage = fiber.percentage / 100;
    
    return {
      name: fiber.name,
      percentage: fiber.percentage,
      grade: impact.grade,
      waterUsage: (impact.waterUsage * weightKg * fiberPercentage).toFixed(1),
      carbonFootprint: (impact.co2 * weightKg * fiberPercentage).toFixed(3),
      biodegradable: impact.biodegradable ? 'Yes' : 'No',
      biodegradabilityTime: impact.biodegradabilityTime || 'Unknown',
      microplasticShedding: impact.microplasticShedding || 0,
      chemicalIntensity: impact.chemicalIntensity || 'N/A',
      waterPollution: impact.waterPollution || 'N/A',
      rateWater: impact.waterUsage,
      rateCo2: impact.co2,
    };
  });
};

/**
 * Convert scans array to detailed CSV string with full breakdown
 * @param {Array} scans - Array of scan objects
 * @returns {string} CSV formatted string
 */
const generateCSV = (scans) => {
  if (!scans || scans.length === 0) {
    return 'No scans to export';
  }

  // main scan headers
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
      // no fiber data - single row for scan
      rows.push([
        new Date(scan.createdAt).toLocaleDateString(),
        `"${scan.brand || 'Unknown'}"`,
        scan.itemType || 'Garment',
        scan.grade || 'N/A',
        scan.score || 'N/A',
        scan.item_weight_grams || 'N/A',
        scan.water_usage_liters || '0',
        scan.carbon_footprint_kg || '0',
        'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A',
      ]);
    } else {
      // one row per fiber
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
          fiber.microplasticShedding,
          fiber.chemicalIntensity,
          fiber.waterPollution,
          fiber.rateWater,
          fiber.rateCo2,
        ]);
      });
    }
  });

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return csv;
};

/**
 * Convert scans array to formatted text report with full breakdown
 * @param {Array} scans - Array of scan objects
 * @returns {string} Formatted text report
 */
const generateTextReport = (scans) => {
  if (!scans || scans.length === 0) {
    return 'No scans to export';
  }

  let content = 'SUSTAINABILITY REPORT - WearAware\n';
  content += `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
  content += '='.repeat(80) + '\n\n';

  // summary statistics
  const totalScans = scans.length;
  const totalWater = scans.reduce((sum, scan) => sum + (scan.water_usage_liters || 0), 0);
  const totalCarbon = scans.reduce((sum, scan) => sum + (scan.carbon_footprint_kg || 0), 0);
  const avgScore = scans.reduce((sum, scan) => sum + (scan.score || 0), 0) / totalScans;
  
  content += 'SUMMARY\n';
  content += '-'.repeat(40) + '\n';
  content += `Total Scans: ${totalScans}\n`;
  content += `Total Water Usage: ${totalWater.toFixed(2)} litres\n`;
  content += `Total Carbon Footprint: ${totalCarbon.toFixed(2)} kg CO₂\n`;
  content += `Average Sustainability Score: ${avgScore.toFixed(1)}/100\n\n`;

  // ireland Context
  content += 'IRELAND CONTEXT\n';
  content += '-'.repeat(40) + '\n';
  content += `Total water footprint: ${((totalWater / 320) * 100).toFixed(1)}% of daily Irish household usage\n`;
  content += `Equivalent to ${Math.round(totalWater / 8)} cups of tea\n`;
  content += `Carbon equal to driving ${(totalCarbon * 4.5).toFixed(1)}km in a petrol car\n\n`;

  content += 'DETAILED SCANS\n';
  content += '='.repeat(80) + '\n\n';

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

    // fiber breakdown
    const fiberBreakdown = getFiberBreakdown(scan);
    if (fiberBreakdown.length > 0) {
      content += `  FIBER BREAKDOWN:\n`;
      fiberBreakdown.forEach((fiber) => {
        content += `  ┌─ ${fiber.name} (${fiber.percentage}%) - Grade ${fiber.grade}\n`;
        content += `  │  Water Contribution: ${fiber.waterUsage}L\n`;
        content += `  │  CO₂ Contribution: ${fiber.carbonFootprint}kg\n`;
        content += `  │  Biodegradable: ${fiber.biodegradable} (${fiber.biodegradabilityTime})\n`;
        content += `  │  Microplastic Shedding: ${fiber.microplasticShedding}mg/kg/wash\n`;
        content += `  │  Chemical Intensity: ${fiber.chemicalIntensity}/100\n`;
        content += `  │  Water Pollution: ${fiber.waterPollution}/100\n`;
        content += `  └─ Rate: ${fiber.rateWater.toLocaleString()}L/kg, ${fiber.rateCo2}kg CO₂/kg\n\n`;
      });
    }

    content += '\n';
  });

  // sustainability Tips
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
 * Get color for grade
 * @param {string} grade - Grade letter (A-F)
 * @returns {string} Color hex code
 */
const getGradeColor = (grade) => {
  switch (grade) {
    case 'A': return colors.gradeA;
    case 'B': return colors.gradeB;
    case 'C': return colors.gradeC;
    case 'D': return colors.gradeD;
    case 'F': return colors.gradeF;
    default: return colors.textSecondary;
  }
};

/**
 * Generate HTML content for PDF export
 * @param {Array} scans - Array of scan objects
 * @returns {string} HTML string
 */
const generatePDFHTML = (scans) => {
  if (!scans || scans.length === 0) {
    return '<html><body><h1>No scans to export</h1></body></html>';
  }

  // calculate summary statistics
  const totalScans = scans.length;
  const totalWater = scans.reduce((sum, scan) => sum + (scan.water_usage_liters || 0), 0);
  const totalCarbon = scans.reduce((sum, scan) => sum + (scan.carbon_footprint_kg || 0), 0);
  const avgScore = scans.reduce((sum, scan) => sum + (scan.score || 0), 0) / totalScans;

  // grade distribution
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scans.forEach((scan) => {
    const grade = scan.grade || 'F';
    if (gradeDistribution[grade] !== undefined) {
      gradeDistribution[grade]++;
    }
  });

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
    <div class="grade-dist">
      ${Object.entries(gradeDistribution).map(([grade, count]) => `
        <div class="grade-item">
          <div class="grade-letter" style="color: ${getGradeColor(grade)}">${grade}</div>
          <div class="grade-count">${count} items</div>
        </div>
      `).join('')}
    </div>
  </div>

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

  // add each scan
  scans.forEach((scan, index) => {
    const fiberBreakdown = getFiberBreakdown(scan);
    const gradeColor = getGradeColor(scan.grade || 'C');

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

    if (fiberBreakdown.length > 0) {
      html += `
      <div class="fiber-section">
        <h4>Fiber Composition & Impact</h4>
`;
      fiberBreakdown.forEach((fiber) => {
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
            <div class="fiber-detail"><span>Microplastics:</span> ${fiber.microplasticShedding}mg/kg</div>
            <div class="fiber-detail"><span>Chemicals:</span> ${fiber.chemicalIntensity}/100</div>
            <div class="fiber-detail"><span>Water pollution:</span> ${fiber.waterPollution}/100</div>
          </div>
        </div>
`;
      });
      html += `      </div>`;
    }

    html += `
    </div>
  </div>
`;
  });

  // add tips and footer
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
 * Export scans as PDF file
 * @param {Array} scans - Array of scan objects
 * @returns {Promise<boolean>} True if export successful
 */
export const exportAsPDF = async (scans) => {
  try {
    const htmlContent = generatePDFHTML(scans);
    
    // generate PDF from HTML
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export Sustainability Report',
        UTI: 'com.adobe.pdf',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }

    return true;
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
};

/**
 * Export scans as CSV file
 * @param {Array} scans - Array of scan objects
 * @param {string} filename - Optional filename (default: sustainability-report.csv)
 * @returns {Promise<boolean>} True if export successful
 */
export const exportAsCSV = async (scans, filename = 'sustainability-report.csv') => {
  try {
    const csvContent = generateCSV(scans);
    const filePath = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filePath, csvContent, {
      encoding: 'utf8',
    });

    // check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Sustainability Report',
        UTI: 'public.comma-separated-values-text',
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
 * Export scans as text file
 * @param {Array} scans - Array of scan objects
 * @param {string} filename - Optional filename (default: sustainability-report.txt)
 * @returns {Promise<boolean>} True if export successful
 */
export const exportAsText = async (scans, filename = 'sustainability-report.txt') => {
  try {
    const textContent = generateTextReport(scans);
    const filePath = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filePath, textContent, {
      encoding: 'utf8',
    });

    // check if sharing is available
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
 * Generate summary statistics for scans
 * @param {Array} scans - Array of scan objects
 * @returns {object} Statistics object
 */
export const generateStatistics = (scans) => {
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

  const totalWater = scans.reduce((sum, scan) => sum + (scan.water_usage_liters || 0), 0);
  const totalCarbon = scans.reduce((sum, scan) => sum + (scan.carbon_footprint_kg || 0), 0);
  const averageScore = scans.reduce((sum, scan) => sum + (scan.score || 0), 0) / scans.length;

  // map average score to grade
  let averageGrade = 'F';
  if (averageScore >= 80) averageGrade = 'A';
  else if (averageScore >= 65) averageGrade = 'B';
  else if (averageScore >= 50) averageGrade = 'C';
  else if (averageScore >= 35) averageGrade = 'D';

  // count grade distribution
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scans.forEach((scan) => {
    const grade = scan.grade || 'F';
    if (gradeDistribution[grade] !== undefined) {
      gradeDistribution[grade]++;
    }
  });

  return {
    totalScans: scans.length,
    totalWater: Math.round(totalWater * 100) / 100,
    totalCarbon: Math.round(totalCarbon * 100) / 100,
    averageGrade,
    averageScore: Math.round(averageScore),
    gradeDistribution,
  };
};
