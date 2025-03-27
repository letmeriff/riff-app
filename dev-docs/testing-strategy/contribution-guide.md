# Riff Testing Contribution Guide

This guide provides instructions for contributing to the Riff testing framework. Follow these guidelines to ensure your tests meet our quality standards and integrate well with our testing strategy.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Types of Tests](#types-of-tests)
3. [Writing Effective Tests](#writing-effective-tests)
4. [Testing Conventions](#testing-conventions)
5. [Pull Request Process](#pull-request-process)
6. [Handling Common Issues](#handling-common-issues)

## Getting Started

### Prerequisites

- Node.js v16 or later
- npm v7 or later
- Familiarity with Jest, React Testing Library, and TypeScript

### Setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/your-org/riff-app.git
   cd riff-app
   npm install
   ```

2. Run existing tests to ensure your environment is set up correctly:
   ```bash
   npm test
   ```

3. Review the testing documentation:
   - [Testing Strategy Overview](./riff-testing-strategy-overview.md)
   - [Testing Patterns and Conventions](./test-patterns.md)
   - [Test Examples](./test-examples.md)

## Types of Tests

Contribute to any of the following test types based on your area of expertise:

### 1. Unit Tests

Test individual functions, components, or modules in isolation:

- Frontend components
- Utility functions
- Redux slices/reducers
- Service methods

### 2. Integration Tests

Test interactions between related components:

- API endpoint flows
- WebSocket communication
- Component hierarchies
- Data flow between services

### 3. End-to-End Tests

Test complete user flows from UI to database and back:

- User authentication
- Canvas creation and editing
- Real-time collaboration
- Data persistence

## Writing Effective Tests

### Test Structure

Follow the Arrange-Act-Assert (AAA) pattern:

```typescript
it('should update a node when edited', async () => {
  // Arrange - set up test preconditions
  const mockNode = { id: 'node1', data: { content: 'Original' } };
  const canvas = renderCanvas([mockNode]);
  
  // Act - perform the action being tested
  await userEvent.click(canvas.getByText('Original'));
  await userEvent.type(canvas.getByRole('textbox'), 'Updated');
  await userEvent.tab(); // Blur to save
  
  // Assert - verify the expected result
  expect(canvas.getByText('Updated')).toBeInTheDocument();
  expect(canvasService.updateNode).toHaveBeenCalled();
});
```

### Test Isolation

Ensure each test is independent:

- Clean up resources in `afterEach`/`afterAll` blocks
- Reset mocks between tests with `jest.clearAllMocks()`
- Don't rely on state from other tests

### Mock External Dependencies

Use consistent mocking patterns:

- For API calls, mock the service modules
- For databases, use mock implementations
- For WebSockets, create mock servers
- For time-dependent features, use Jest's timer mocks

## Testing Conventions

### Naming Conventions

Use descriptive test names:

- Test files: `[ComponentName].test.ts(x)` or `[FeatureName].test.ts`
- Test descriptions: `it('should [expected behavior] when [condition]')`

### Test Organization

Organize tests by feature and behavior:

```typescript
describe('NodeService', () => {
  describe('getNode', () => {
    it('should return a node when it exists');
    it('should return null when node does not exist');
    it('should throw an error when database fails');
  });
  
  describe('createNode', () => {
    // Tests for creating nodes
  });
});
```

### Code Coverage

Aim for high code coverage:

- Minimum 80% coverage for new code
- Test all branches and edge cases
- Focus on critical paths and error handling

## Pull Request Process

1. **Branch naming**: Use `test/feature-name` for test-only PRs
2. **Run all tests**: Ensure all tests pass locally before submitting
3. **Coverage report**: Include coverage report in your PR description
4. **Documentation**: Update test documentation if adding new testing patterns
5. **Review**: Request review from at least one team member familiar with testing
6. **CI/CD**: Address any failing tests in the CI pipeline

## Handling Common Issues

### Flaky Tests

If your tests are inconsistent or fail intermittently:

1. Check for race conditions and asynchronous code
2. Use explicit waits rather than arbitrary timeouts
3. Mock network requests and timers
4. Ensure proper isolation between tests

### Testing Yjs Collaborative Features

When testing collaborative features:

1. Create multiple documents and providers in memory
2. Simulate user actions on both sides
3. Wait for synchronization to occur
4. Verify documents have merged correctly

Example:

```typescript
// Create two disconnected docs
const doc1 = new Y.Doc();
const doc2 = new Y.Doc();

// Make changes to doc1
doc1.getMap('nodes').set('node1', { content: 'Test' });

// Sync from doc1 to doc2
const update = Y.encodeStateAsUpdate(doc1);
Y.applyUpdate(doc2, update);

// Verify doc2 received the changes
expect(doc2.getMap('nodes').get('node1').content).toBe('Test');
```

### Mock Supabase Effectively

For Supabase testing:

1. Mock both auth and database operations
2. Use consistent mock patterns for chained methods
3. Handle promises and async operations properly

See [test-patterns.md](./test-patterns.md) for detailed Supabase mocking examples.

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [TypeScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Need Help?

If you're stuck or have questions about testing:

1. Check existing test files for similar patterns
2. Review the testing documentation
3. Reach out to the testing team on Slack (#testing-help)
4. Ask for help in your PR with specific questions

Happy testing! Together we can build a more reliable Riff application. 