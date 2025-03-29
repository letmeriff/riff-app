/**
 * Lighthouse configuration for Riff performance testing
 */
module.exports = {
  extends: 'lighthouse:default',
  settings: {
    // Only run performance audits
    onlyAudits: [
      'first-contentful-paint',
      'speed-index',
      'largest-contentful-paint',
      'interactive',
      'total-blocking-time',
      'cumulative-layout-shift',
      'server-response-time',
      'mainthread-work-breakdown',
      'bootup-time',
      'network-requests',
      'network-rtt',
      'network-server-latency',
      'render-blocking-resources',
      'dom-size',
    ],
    // Skip the PWA audits
    skipAudits: [
      'service-worker',
      'installable-manifest',
      'apple-touch-icon',
      'maskable-icon',
      'offline-start-url',
    ],
    formFactor: 'desktop',
    throttling: {
      // Simulated throttling settings
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },
  // Performance thresholds
  assertions: {
    'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
    'largest-contentful-paint': ['error', { maxNumericValue: 3000 }],
    'interactive': ['error', { maxNumericValue: 4000 }],
    'total-blocking-time': ['error', { maxNumericValue: 500 }],
    'cumulative-layout-shift': ['error', { maxNumericValue: 0.25 }],
  }
}; 