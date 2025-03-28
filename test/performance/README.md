# Riff Performance Testing

This directory contains the performance testing infrastructure for the Riff application. The tests are designed to measure and establish baselines for various performance aspects of the application.

## Test Categories

The performance tests are divided into three main categories:

1. **Client-side Performance Tests** - Using Lighthouse to measure loading and rendering performance
2. **API Performance Tests** - Using k6 to measure API response times and throughput
3. **Canvas Rendering Tests** - Using Playwright to measure canvas rendering performance with different node counts

## Running the Tests

### All Tests

To run all performance tests with default configuration (less intensive):

```bash
npm run test:performance
```

To run the full test suite (more intensive, includes stress tests):

```bash
npm run test:performance:full
```

### Individual Test Categories

#### Lighthouse Tests

```bash
npm run test:performance:lighthouse
```

#### API Load Tests

```bash
npm run test:performance:api
```

#### Canvas Rendering Tests

```bash
npm run test:performance:canvas
```

## Test Reports

After running the tests, reports are generated in the `test-results/performance` directory:

- `lighthouse-report.html` - Detailed Lighthouse performance report
- `api-load-test-results.json` - k6 API test results
- `playwright-report/` - Playwright test results
- `performance-summary.md` - Combined summary of all test results

## Performance Thresholds

The tests include performance thresholds that should be maintained:

### Client-side Performance
- First Contentful Paint: < 2.0s
- Largest Contentful Paint: < 3.0s
- Time to Interactive: < 4.0s
- Total Blocking Time: < 500ms
- Cumulative Layout Shift: < 0.25

### API Performance
- 95th percentile response time: < 1000ms
- Error rate: < 1%

### Canvas Rendering
- Time to Interactive: < 5000ms
- Minimum FPS during navigation: > 20
- Maximum CPU usage: < 35%
- Maximum memory usage: < 350MB

## Adding New Tests

### Adding a Lighthouse Test Configuration

Modify the `lighthouse.config.js` file to adjust thresholds or add new audits.

### Adding a k6 API Test

1. Create a new test script in `test/performance/k6/`
2. Define scenarios, metrics, and thresholds
3. Add a new npm script to package.json

### Adding a Canvas Rendering Test

1. Add test configurations to `e2e/performance/canvas-rendering.test.ts`
2. Update thresholds as needed
3. Add helper functions to `e2e/utils/performance-test-utils.ts`

## Continuous Integration

Performance tests are integrated into the CI pipeline but run on a reduced schedule:

- Full suite runs weekly
- Lighthouse and Playwright smoke tests run on PRs to main branch
- API tests run daily on main branch

## Troubleshooting

### Lighthouse Issues

If Lighthouse fails to run:
- Check that you have Chrome installed
- Try running with `--chrome-flags="--headless --disable-gpu --no-sandbox"`

### k6 Issues

If k6 tests fail:
- Check that the API server is running
- Verify that test user credentials are valid
- Adjust thresholds if environment constraints are different

### Playwright Issues

If Playwright tests fail:
- Run `npx playwright install` to ensure browsers are installed
- Check that test data creation is working correctly
- Verify selectors if page structure has changed 