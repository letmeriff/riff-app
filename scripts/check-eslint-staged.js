#!/usr/bin/env node

/**
 * check-eslint-staged.js
 * 
 * A script to run specialized ESLint checks on staged TypeScript files.
 * This script is part of the pre-commit hook and enforces code quality patterns
 * established during the ESLint implementation workflow.
 * 
 * Usage: Automatically called by lint-staged on pre-commit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI colors for better terminal output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// Get the filenames passed from lint-staged
const stagedFiles = process.argv.slice(2);

// Exit early if no files to check
if (stagedFiles.length === 0) {
  console.log(`${COLORS.yellow}No TypeScript files to check${COLORS.reset}`);
  process.exit(0);
}

console.log(`${COLORS.bold}${COLORS.blue}Checking ${stagedFiles.length} staged TypeScript files...${COLORS.reset}`);

// Function to run ESLint checks with specific rules
function runEslintCheck(files, ruleName, severity = 'error', extraArgs = []) {
  const filesArg = files.join(' ');
  try {
    execSync(
      `npx eslint ${filesArg} --rule "${ruleName}: ${severity}" ${extraArgs.join(' ')}`,
      { stdio: 'pipe' }
    );
    return { passed: true };
  } catch (error) {
    // ESLint returns non-zero exit code when it finds issues
    const output = error.stdout.toString();
    return { 
      passed: false, 
      output 
    };
  }
}

// Check for critical ESLint issues
const typeSafetyResults = runEslintCheck(stagedFiles, '@typescript-eslint/no-explicit-any');
const banTypesResults = runEslintCheck(stagedFiles, '@typescript-eslint/ban-types');
const unusedVarsResults = runEslintCheck(stagedFiles, '@typescript-eslint/no-unused-vars');
const requiresResults = runEslintCheck(stagedFiles, '@typescript-eslint/no-var-requires');
const prototypeResults = runEslintCheck(stagedFiles, 'no-prototype-builtins');

// Check current patterns established in the project
let passedAll = true;
const issues = [];

// Collect results
if (!typeSafetyResults.passed) {
  passedAll = false;
  issues.push({
    rule: '@typescript-eslint/no-explicit-any',
    output: typeSafetyResults.output,
    suggestion: `Replace 'any' with 'unknown' or a more specific type.
- For generic values: use 'unknown'
- For objects: use 'Record<string, unknown>'
- Create specific interfaces for complex structures
- Use domain-specific interfaces for structured data`
  });
}

if (!banTypesResults.passed) {
  passedAll = false;
  issues.push({
    rule: '@typescript-eslint/ban-types',
    output: banTypesResults.output,
    suggestion: `Replace 'Function' with proper function signatures.
- Use specific signatures like '(param: Type) => ReturnType'
- For generic callbacks: '(...args: unknown[]) => void'
- Create type aliases for common callback patterns`
  });
}

if (!unusedVarsResults.passed) {
  passedAll = false;
  issues.push({
    rule: '@typescript-eslint/no-unused-vars',
    output: unusedVarsResults.output,
    suggestion: `Fix unused variables by either:
- Prefixing with underscore (_variableName)
- Removing the unused variable/import
- Actually using the variable in your code`
  });
}

if (!requiresResults.passed) {
  passedAll = false;
  issues.push({
    rule: '@typescript-eslint/no-var-requires',
    output: requiresResults.output,
    suggestion: `Use ES6 imports instead of requires:
- Change 'const module = require("module")' to 'import module from "module"'
- For CommonJS modules, use 'import * as module from "module"'
- In Jest tests, use 'jest.requireMock()' for specific cases`
  });
}

if (!prototypeResults.passed) {
  passedAll = false;
  issues.push({
    rule: 'no-prototype-builtins',
    output: prototypeResults.output,
    suggestion: `Avoid direct access to Object.prototype methods:
- Change 'obj.hasOwnProperty(key)' to 'Object.prototype.hasOwnProperty.call(obj, key)'
- Alternatively, use 'Object.hasOwn(obj, key)' for modern environments`
  });
}

// Display results with helpful suggestions
if (passedAll) {
  console.log(`${COLORS.green}✓ All checks passed! The code follows established patterns.${COLORS.reset}`);
  process.exit(0);
} else {
  console.log(`\n${COLORS.red}${COLORS.bold}ESLint issues found in your staged files:${COLORS.reset}\n`);
  
  issues.forEach(issue => {
    console.log(`${COLORS.yellow}${COLORS.bold}Rule: ${issue.rule}${COLORS.reset}`);
    console.log(`${COLORS.cyan}Suggestions:${COLORS.reset}`);
    console.log(issue.suggestion);
    console.log(`\n${COLORS.white}Output:${COLORS.reset}`);
    console.log(issue.output);
    console.log("-".repeat(80));
  });
  
  console.log(`
${COLORS.bold}${COLORS.blue}How to fix:${COLORS.reset}
1. Make the suggested changes to fix the issues
2. Stage your changes (git add <files>)
3. Try committing again

${COLORS.bold}${COLORS.yellow}Note:${COLORS.reset} You can run 'npm run lint:fix' to automatically fix some issues.
  `);
  
  // Exit with error code to prevent the commit
  process.exit(1);
} 