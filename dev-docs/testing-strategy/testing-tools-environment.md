# Testing Tools and Environment

This document outlines the tools, libraries, and environment configuration needed for the Riff testing strategy.

## Frontend Testing Tools

### Core Testing Framework

- **Jest**: Primary test runner and assertion library
- **ts-jest**: TypeScript integration for Jest

### Component Testing

- **React Testing Library**: DOM testing utilities for React components
- **@testing-library/user-event**: Simulates user events for interaction testing
- **jest-dom**: Custom DOM element matchers

### Mocking

- **MSW (Mock Service Worker)**: API mocking for browser and Node.js
- **jest-mock-extended**: TypeScript-friendly mock creation

### Visual Testing

- **Storybook**: Component development and visual testing
- **@storybook/testing-react**: Testing stories with Jest

## Backend Testing Tools

### Core Testing Framework

- **Jest**: Primary test runner for backend code
- **ts-jest**: TypeScript integration for Jest

### API Testing

- **Supertest**: HTTP assertions for testing Express servers
- **pactum**: REST API testing tool with request/response validation

### Database Testing

- **Testcontainers**: Isolated Docker containers for testing
- **pg-mem**: In-memory PostgreSQL for database testing

### WebSocket Testing

- **Socket.IO Client**: Testing Socket.IO connections
- **ws**: WebSocket client for testing raw WebSocket connections

## End-to-End Testing

### Core E2E Framework

- **Playwright**: Browser automation and testing
- **@playwright/test**: Playwright's test runner

### Visual Regression

- **Playwright's snapshot testing**: For visual regression tests

## Specialized Testing Tools

### Yjs Testing

- **y-websocket/tests**: Utility for testing Y WebSocket providers
- Custom test harness for Yjs document testing

### Collaborative Testing

- Custom multi-client test framework
- Network condition simulator

## Environment Configuration

### Jest Configuration

```javascript
// jest.config.js for frontend
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(yjs|y-protocols|y-websocket|y-indexeddb|lib0)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/mocks/**',
  ],
};
```

```javascript
// jest.config.js for backend
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(yjs|y-protocols|lib0)/)'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/mocks/**'],
};
```

### Setup Files

```typescript
// frontend/src/setupTests.ts
import '@testing-library/jest-dom';
import { server } from './mocks/server';

// Mock global fetch
global.fetch = jest.fn();

// Setup MSW
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock Yjs and related libraries
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
  };

  return {
    Doc: jest.fn(() => mockDoc),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
  };
});

// Additional mocks for other ES modules
```

```typescript
// backend/src/setupTests.ts
import { server } from './mocks/server';

// Setup database
beforeAll(async () => {
  // Initialize in-memory database
});

afterAll(async () => {
  // Close database connections
});

// Setup MSW
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock Yjs
jest.mock('yjs', () => {
  // Yjs mock implementation
});
```

## Playwright Configuration

```javascript
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
};

export default config;
```

## Continuous Integration Setup

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## Local Development Setup

```sh
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Run all tests
npm test

# Generate coverage report
npm run coverage
```

With this tooling setup, we establish a robust foundation for implementing the comprehensive testing strategy for Riff.
