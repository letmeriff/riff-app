/**
 * Setup Test Environment
 *
 * This file is executed by Jest before running tests.
 * It sets up the testing environment and imports required mocks.
 */

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock CSS modules
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
class LocalStorageMock {
  store: Record<string, string>;

  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

// Set up localStorage mock
Object.defineProperty(window, 'localStorage', {
  value: new LocalStorageMock(),
  writable: true,
});

// Suppress React 18 act warnings (when you can't wrap in act)
// This is needed when testing components that trigger async updates
const originalError = console.error;
console.error = (...args) => {
  if (/Warning.*not wrapped in act/.test(args[0])) {
    return;
  }
  originalError(...args);
};

// Import modern testing mocks for ReactFlow and Yjs
import './test-utils/mocks/reactflow.mock';
import './test-utils/mocks/yjs.mock';

// Mock global fetch if needed
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
  } as unknown as Response)
);

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Suppress React 18 console errors from tests
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('ReactDOM.render is no longer supported') ||
      args[0].includes('act(...) is not supported in production builds'))
  ) {
    return;
  }
  originalConsoleError(...args);
};
