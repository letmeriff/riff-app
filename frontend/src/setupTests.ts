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
