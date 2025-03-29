/**
 * Example ESLint configuration with test-specific overrides
 * 
 * This configuration demonstrates how to customize ESLint rules for test files
 * to address common issues while maintaining appropriate strictness.
 */

module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended',
    'plugin:testing-library/react',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jest', 'testing-library'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    es2020: true,
    jest: true,
    node: true,
  },
  settings: {
    jest: {
      version: 'detect',
    },
  },
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/ban-types': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error',
    'jest/expect-expect': ['error', { "assertFunctionNames": ["expect", "assert*"] }],
    'jest/no-conditional-expect': 'error',
  },
  // Specific overrides for test files
  overrides: [
    {
      // Apply these rules to all test files
      files: [
        '**/*.test.ts', 
        '**/*.test.tsx', 
        '**/__tests__/**/*.ts', 
        '**/__tests__/**/*.tsx',
        '**/test-utils/**/*.ts',
        '**/test-utils/**/*.tsx',
        '**/mocks/**/*.ts', 
        '**/mocks/**/*.tsx'
      ],
      rules: {
        // Relax some overly strict rules for tests
        '@typescript-eslint/no-explicit-any': 'off', // Allow any in test files
        '@typescript-eslint/ban-types': 'warn', // Downgrade to warning in test files
        '@typescript-eslint/no-non-null-assertion': 'off', // Allow non-null assertions in tests
        'jest/no-conditional-expect': 'warn', // Downgrade to warning
        '@typescript-eslint/no-var-requires': 'off', // Allow requires in test files
        
        // Add stricter rules for tests
        'jest/expect-expect': ['error', {
          // Consider custom assertion functions as valid expectations
          "assertFunctionNames": ["expect", "assert*", "verify*", "waitFor*"]
        }],
        'jest/no-identical-title': 'error',
        'testing-library/await-async-queries': 'error',
        'testing-library/no-await-sync-queries': 'error',
        'testing-library/no-render-in-setup': 'error',
      }
    },
    // Special override for test utilities
    {
      files: [
        '**/test-utils/**/*.ts',
        '**/test-utils/**/*.tsx',
        '**/mocks/**/*.ts',
        '**/mocks/**/*.tsx'
      ],
      rules: {
        // Utility files often need to use Function types and any
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        // Test utilities don't need expectations
        'jest/expect-expect': 'off',
      }
    },
    // Special override for test mocks
    {
      files: ['**/jest.setup.ts', '**/*.mock.ts', '**/*.mock.tsx'],
      rules: {
        // Mocks often need to use requires
        '@typescript-eslint/no-var-requires': 'off',
        // Allow empty functions in mocks
        '@typescript-eslint/no-empty-function': 'off'
      }
    },
    // Special case for Yjs integration tests
    {
      files: ['**/yjs*/**/*.test.ts', '**/collaboration*/**/*.test.ts'],
      rules: {
        // Collaboration tests often need conditional expects due to timing
        'jest/no-conditional-expect': 'off',
      }
    }
  ]
}; 