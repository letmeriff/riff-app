/**
 * Centralized Configuration
 *
 * This module provides shared configuration variables for development tools,
 * linting, testing, and deployment processes.
 */

module.exports = {
  // Source code patterns
  sourceFiles: '**/*.{ts,tsx,js,jsx}',
  testFiles: '**/*.{test.ts,test.tsx,spec.ts,spec.tsx}',

  // Common ignore patterns
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '.next/',
    '*.config.js',
    '*.config.ts',
  ],

  // Feature flags
  features: {
    canvas: {
      get refactored() {
        return process.env.REACT_APP_CANVAS_REFACTORED === 'true';
      },
      get performanceMonitoring() {
        return process.env.REACT_APP_CANVAS_PERFORMANCE === 'true';
      },
      get virtualization() {
        return process.env.REACT_APP_CANVAS_VIRTUALIZATION === 'true';
      },
    },
  },

  // Testing configuration
  testing: {
    coverageThreshold: {
      global: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    testTimeoutMs: 10000,
  },
};
