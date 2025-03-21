module.exports = {
  extends: [
    'eslint:recommended', 
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended',
    'plugin:testing-library/react'
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
    node: true
  },
  settings: {
    jest: {
      version: 'detect'
    }
  },
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      env: {
        jest: true
      }
    }
  ]
};
