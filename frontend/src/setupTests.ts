// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

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

// Mock Yjs and related ES modules
jest.mock('yjs', () => {
  const mockDoc = {
    on: jest.fn(),
    off: jest.fn(),
    clientID: 1,
    getMap: jest.fn(() => ({
      set: jest.fn(),
      get: jest.fn(),
      observe: jest.fn(),
    })),
    getText: jest.fn(),
    transact: jest.fn((fn) => fn()),
    destroy: jest.fn(),
    encodeStateAsUpdate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  };
  
  return {
    Doc: jest.fn(() => mockDoc),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
  };
});

jest.mock('y-websocket', () => {
  const mockAwareness = {
    setLocalState: jest.fn(),
    getLocalState: jest.fn(() => ({})),
    on: jest.fn(),
    off: jest.fn(),
    getStates: jest.fn(() => new Map()),
  };
  
  return {
    WebsocketProvider: jest.fn(() => ({
      awareness: mockAwareness,
      on: jest.fn(),
      off: jest.fn(),
      wsconnected: true,
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
  };
});

jest.mock('y-indexeddb', () => ({
  IndexeddbPersistence: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    destroy: jest.fn(),
  })),
}));
