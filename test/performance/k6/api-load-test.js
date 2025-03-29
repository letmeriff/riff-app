/**
 * k6 Load Test Script for Riff API Endpoints
 * 
 * This script tests the performance of critical API endpoints under various load conditions.
 * It simulates multiple users accessing the application simultaneously.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const canvasLoadingTime = new Trend('canvas_loading_time');
const nodesCreationTime = new Trend('nodes_creation_time');
const edgesCreationTime = new Trend('edges_creation_time');
const userAuthTime = new Trend('user_auth_time');

// Test configuration with different scenarios
export const options = {
  scenarios: {
    // Smoke test - minimal load to verify the script works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { test_type: 'smoke' },
    },
    // Load test - normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      tags: { test_type: 'load' },
    },
    // Stress test - find the breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 30 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },
    // Spike test - sudden surge in traffic
    spike: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 30 },
        { duration: '1m', target: 30 },
        { duration: '10s', target: 1 },
      ],
      tags: { test_type: 'spike' },
    },
  },
  thresholds: {
    'errors': ['rate<0.1'], // Less than 10% errors
    'http_req_duration': ['p(95)<1000'], // 95% of requests should be below 1s
    'canvas_loading_time': ['p(95)<1500'], // 95% of canvas loads under 1.5s
    'nodes_creation_time': ['p(95)<500'], // 95% of node creations under 500ms
    'edges_creation_time': ['p(95)<300'], // 95% of edge creations under 300ms
    'user_auth_time': ['p(95)<800'], // 95% of auth operations under 800ms
  },
};

// Initial setup - generate test data, authenticate, etc.
export function setup() {
  // Create a test user or authenticate as an existing user
  const loginRes = http.post('http://localhost:3000/api/auth/login', {
    email: 'performance-test@example.com',
    password: 'test-password',
  });
  
  // Measure authentication time
  userAuthTime.add(loginRes.timings.duration);
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });
  
  const authToken = loginRes.json('accessToken');
  
  // Create a test canvas to use during tests
  const createCanvasRes = http.post('http://localhost:3000/api/canvas', 
    JSON.stringify({ name: 'Performance Test Canvas' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    }
  );
  
  check(createCanvasRes, {
    'canvas created': (r) => r.status === 201,
  });
  
  const canvasId = createCanvasRes.json('id');
  
  return {
    authToken,
    canvasId,
  };
}

// Main test function
export default function(data) {
  const { authToken, canvasId } = data;
  
  // Common request headers
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };
  
  // Test 1: Retrieve canvas data
  const startCanvasLoad = new Date().getTime();
  const canvasRes = http.get(`http://localhost:3000/api/canvas/${canvasId}`, { headers });
  canvasLoadingTime.add(new Date().getTime() - startCanvasLoad);
  
  const canvasCheckResult = check(canvasRes, {
    'canvas retrieved': (r) => r.status === 200,
    'canvas contains data': (r) => r.json('id') !== undefined,
  });
  errorRate.add(!canvasCheckResult);
  
  // Test 2: Create a new node
  const startNodeCreation = new Date().getTime();
  const nodeData = {
    type: 'text',
    position: { x: Math.random() * 500, y: Math.random() * 500 },
    data: { content: 'Performance test node' },
  };
  
  const nodeRes = http.post(
    `http://localhost:3000/api/canvas/${canvasId}/nodes`,
    JSON.stringify(nodeData),
    { headers }
  );
  nodesCreationTime.add(new Date().getTime() - startNodeCreation);
  
  const nodeCheckResult = check(nodeRes, {
    'node created': (r) => r.status === 201,
    'node contains id': (r) => r.json('id') !== undefined,
  });
  errorRate.add(!nodeCheckResult);
  
  const nodeId = nodeRes.json('id');
  
  // Test 3: Create an edge between nodes
  if (nodeId) {
    const startEdgeCreation = new Date().getTime();
    const edgeData = {
      source: nodeId,
      target: nodeId, // In a real test, we'd use a different nodeId
      data: { label: 'Performance test edge' },
    };
    
    const edgeRes = http.post(
      `http://localhost:3000/api/canvas/${canvasId}/edges`,
      JSON.stringify(edgeData),
      { headers }
    );
    edgesCreationTime.add(new Date().getTime() - startEdgeCreation);
    
    const edgeCheckResult = check(edgeRes, {
      'edge created': (r) => r.status === 201,
      'edge contains id': (r) => r.json('id') !== undefined,
    });
    errorRate.add(!edgeCheckResult);
  }
  
  // Add think time between requests
  sleep(Math.random() * 3 + 1); // Random sleep between 1-4 seconds
}

// Cleanup function to run after the test completes
export function teardown(data) {
  // Delete test data created during the test
  const { authToken, canvasId } = data;
  
  http.del(`http://localhost:3000/api/canvas/${canvasId}`, null, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
} 