/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(yjs|y-protocols|lib0|y-websocket)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.integration.ts', '**/?(*.)+(integration).test.ts'],
  testTimeout: 30000, // Longer timeout for integration tests
  globalSetup: '<rootDir>/src/test-utils/db/setupTestDb.ts',
  globalTeardown: '<rootDir>/src/test-utils/db/teardownTestDb.ts',
}; 