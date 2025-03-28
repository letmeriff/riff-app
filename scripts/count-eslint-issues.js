#!/usr/bin/env node

/**
 * Count ESLint Issues Script
 * 
 * This script reads ESLint output in JSON format from stdin and produces
 * a summary of issues grouped by rule and severity.
 * 
 * Usage:
 *   npx eslint --ext .ts,.tsx . --format json | node scripts/count-eslint-issues.js
 */

let jsonInput = '';

// Read JSON input from stdin
process.stdin.on('data', (chunk) => {
  jsonInput += chunk;
});

process.stdin.on('end', () => {
  try {
    // Parse the JSON input
    const lintResults = JSON.parse(jsonInput);
    
    // Initialize counters
    const summary = {
      errorCount: 0,
      warningCount: 0,
      byRule: {},
      byFile: {},
      byCategory: {
        'Type Safety': {
          rules: ['@typescript-eslint/no-explicit-any', '@typescript-eslint/ban-types'],
          errorCount: 0,
          warningCount: 0
        },
        'Unused Variables': {
          rules: ['@typescript-eslint/no-unused-vars'],
          errorCount: 0,
          warningCount: 0
        },
        'Import Issues': {
          rules: ['@typescript-eslint/no-var-requires', 'import/no-unresolved'],
          errorCount: 0,
          warningCount: 0
        },
        'Test Quality': {
          rules: ['jest/expect-expect', 'jest/no-conditional-expect', 'jest/valid-expect'],
          errorCount: 0,
          warningCount: 0
        },
        'TypeScript Comments': {
          rules: ['@typescript-eslint/ban-ts-comment', '@typescript-eslint/prefer-ts-expect-error'],
          errorCount: 0,
          warningCount: 0
        },
        'Other': {
          rules: [],
          errorCount: 0,
          warningCount: 0
        }
      }
    };

    // Process each file's results
    lintResults.forEach(fileResult => {
      if (!fileResult.messages || fileResult.messages.length === 0) {
        return;
      }
      
      // Create file summary
      const filePath = fileResult.filePath.replace(process.cwd(), '');
      summary.byFile[filePath] = {
        errorCount: fileResult.errorCount,
        warningCount: fileResult.warningCount
      };

      // Update total counts
      summary.errorCount += fileResult.errorCount;
      summary.warningCount += fileResult.warningCount;

      // Process each message (issue)
      fileResult.messages.forEach(message => {
        const { ruleId, severity } = message;
        
        if (!ruleId) return;

        // Initialize the rule in the byRule object if not exists
        if (!summary.byRule[ruleId]) {
          summary.byRule[ruleId] = {
            errorCount: 0,
            warningCount: 0
          };
        }

        // Update rule counts
        if (severity === 2) { // error
          summary.byRule[ruleId].errorCount++;
        } else if (severity === 1) { // warning
          summary.byRule[ruleId].warningCount++;
        }

        // Update category counts
        let assigned = false;
        for (const [category, data] of Object.entries(summary.byCategory)) {
          if (data.rules.includes(ruleId)) {
            if (severity === 2) {
              summary.byCategory[category].errorCount++;
            } else if (severity === 1) {
              summary.byCategory[category].warningCount++;
            }
            assigned = true;
            break;
          }
        }

        // If not assigned to a specific category, add to "Other"
        if (!assigned) {
          if (severity === 2) {
            summary.byCategory.Other.errorCount++;
          } else if (severity === 1) {
            summary.byCategory.Other.warningCount++;
          }
          
          // Add to the "Other" category's rules list if not already there
          if (!summary.byCategory.Other.rules.includes(ruleId)) {
            summary.byCategory.Other.rules.push(ruleId);
          }
        }
      });
    });

    // Print summary
    console.log('\n======= ESLint Issues Summary =======\n');
    
    console.log(`Total: ${summary.errorCount + summary.warningCount} issues (${summary.errorCount} errors, ${summary.warningCount} warnings)`);
    
    console.log('\n--- By Category ---\n');
    for (const [category, data] of Object.entries(summary.byCategory)) {
      const total = data.errorCount + data.warningCount;
      if (total > 0) {
        console.log(`${category}: ${total} issues (${data.errorCount} errors, ${data.warningCount} warnings)`);
      }
    }
    
    console.log('\n--- By Rule ---\n');
    
    // Sort rules by total count
    const sortedRules = Object.entries(summary.byRule)
      .sort((a, b) => {
        const totalA = a[1].errorCount + a[1].warningCount;
        const totalB = b[1].errorCount + b[1].warningCount;
        return totalB - totalA;
      });
    
    sortedRules.forEach(([ruleId, counts]) => {
      const total = counts.errorCount + counts.warningCount;
      console.log(`${ruleId}: ${total} issues (${counts.errorCount} errors, ${counts.warningCount} warnings)`);
    });
    
    console.log('\n--- Top 10 Files with Issues ---\n');
    
    // Sort files by total count
    const sortedFiles = Object.entries(summary.byFile)
      .sort((a, b) => {
        const totalA = a[1].errorCount + a[1].warningCount;
        const totalB = b[1].errorCount + b[1].warningCount;
        return totalB - totalA;
      })
      .slice(0, 10);
    
    sortedFiles.forEach(([filePath, counts]) => {
      const total = counts.errorCount + counts.warningCount;
      console.log(`${filePath}: ${total} issues (${counts.errorCount} errors, ${counts.warningCount} warnings)`);
    });
    
    console.log('\n======================================\n');

  } catch (error) {
    console.error('Error processing ESLint results:', error);
    process.exit(1);
  }
});

process.stdin.resume(); 