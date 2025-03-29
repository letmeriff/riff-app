/**
 * Script to merge coverage reports from frontend and backend
 * and generate a combined report
 */
const fs = require('fs');
const path = require('path');
const { createInstrumenter } = require('istanbul-lib-instrument');
const { createCoverageMap } = require('istanbul-lib-coverage');
const { createContext } = require('istanbul-lib-report');
const reports = require('istanbul-reports');

// Paths to the coverage reports
const frontendCoveragePath = path.resolve(__dirname, '../frontend/coverage/coverage-final.json');
const backendCoveragePath = path.resolve(__dirname, '../backend/coverage/coverage-final.json');
const outputDir = path.resolve(__dirname, '../coverage-report');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Load coverage data
let frontendCoverage = {};
let backendCoverage = {};

try {
  if (fs.existsSync(frontendCoveragePath)) {
    frontendCoverage = JSON.parse(fs.readFileSync(frontendCoveragePath, 'utf8'));
    console.log('Loaded frontend coverage data');
  } else {
    console.warn('Frontend coverage data not found');
  }
} catch (error) {
  console.error('Error loading frontend coverage:', error);
}

try {
  if (fs.existsSync(backendCoveragePath)) {
    backendCoverage = JSON.parse(fs.readFileSync(backendCoveragePath, 'utf8'));
    console.log('Loaded backend coverage data');
  } else {
    console.warn('Backend coverage data not found');
  }
} catch (error) {
  console.error('Error loading backend coverage:', error);
}

// Create a coverage map
const coverageMap = createCoverageMap({});

// Add coverage data to the map
Object.entries(frontendCoverage).forEach(([filename, data]) => {
  coverageMap.addFileCoverage(data);
});

Object.entries(backendCoverage).forEach(([filename, data]) => {
  coverageMap.addFileCoverage(data);
});

// Calculate summary
const summaryMap = {};
const summary = coverageMap.getCoverageSummary();

// Write the summary to a file
const summaryData = {
  total: summary.toJSON(),
  frontend: frontendCoverage ? Object.keys(frontendCoverage).length : 0,
  backend: backendCoverage ? Object.keys(backendCoverage).length : 0,
  timestamp: new Date().toISOString()
};

fs.writeFileSync(
  path.resolve(outputDir, 'coverage-summary.json'),
  JSON.stringify(summaryData, null, 2)
);

// Generate reports
const context = createContext({
  dir: outputDir,
  coverageMap
});

// Generate HTML report
reports.create('html').execute(context);
reports.create('lcov').execute(context);
reports.create('text-summary').execute(context);

console.log(`
Combined Coverage Report:
-------------------------
Statements: ${summary.statements.pct.toFixed(2)}%
Branches: ${summary.branches.pct.toFixed(2)}%
Functions: ${summary.functions.pct.toFixed(2)}%
Lines: ${summary.lines.pct.toFixed(2)}%

Report generated at: ${outputDir}
`); 