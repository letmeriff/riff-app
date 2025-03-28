# CanvasPage Refactoring Testing Strategy

## Testing Challenges

The current CanvasPage component presents several testing challenges:

1. **Complex Dependencies**: ReactFlow, Yjs, Supabase, and Socket.io are difficult to mock effectively
2. **Real-time Behavior**: Collaborative features require testing with multiple simulated users
3. **Component Size**: The large component has many responsibilities making comprehensive testing difficult
4. **State Complexity**: The component manages many interconnected state variables
5. **Asynchronous Operations**: Many operations are asynchronous and require careful test timing

## Testing Approach

The refactoring will implement a comprehensive testing strategy with the following approach:

### 1. Unit Testing for Custom Hooks

Each custom hook will be tested in isolation with:

- **Mock Dependencies**: Service dependencies will be mocked
- **Test Fixtures**: Standard test data will be used across tests
- **State Tracking**: Tests will verify state changes
- **Edge Cases**: Tests will cover error handling and edge cases
- **Test-Driven Development**: Tests will be written before implementation

### 2. Component Testing

Each new component will be tested with:

- **Render Testing**: Verify components render correctly
- **Interaction Testing**: Test user interactions like clicks and drags
- **Props Testing**: Verify components respond to props changes
- **Context Testing**: Test component behavior with different context values
- **Snapshot Testing**: Use snapshots for UI regression testing

### 3. Integration Testing

Integration tests will verify:

- **Hook Composition**: Test how hooks work together
- **Component Composition**: Test component hierarchies
- **Data Flow**: Verify data flows correctly between components
- **Service Integration**: Test integration with critical services

### 4. Collaborative Feature Testing

For real-time collaborative features:

- **Multi-User Simulation**: Test with multiple simulated users
- **Network Condition Simulation**: Test with various network conditions
- **Conflict Resolution Testing**: Verify conflict resolution works correctly
- **Offline Mode Testing**: Test offline behavior and synchronization

### 5. Performance Testing

Performance tests will check:

- **Rendering Performance**: Measure render times for various canvas sizes
- **Memory Usage**: Track memory usage for large canvases
- **Network Efficiency**: Measure network payload sizes and frequencies
- **Synchronization Speed**: Test synchronization performance

## Testing Tools and Utilities

### 1. Testing Mocks

We will develop specialized mocks for:

```typescript
// ReactFlow mock
export const mockReactFlow = {
  nodes: [],
  edges: [],
  onNodesChange: jest.fn(),
  onEdgesChange: jest.fn(),
  onConnect: jest.fn(),
  // Additional ReactFlow props and methods
};

// Yjs mock
export const mockYjs = {
  ydoc: {
    getMap: jest.fn().mockReturnValue({
      set: jest.fn(),
      get: jest.fn(),
      observe: jest.fn(),
      // Additional Y.Map methods
    }),
  },
  isConnected: true,
  // Additional Yjs context properties
};

// Multi-user test harness
export const createMultiUserTestHarness = (userCount: number) => {
  // Create simulated users with independent state
  // Return methods for simulating user actions
};
```

### 2. Test Fixtures

Standard test fixtures will include:

```typescript
// Node fixtures
export const testNodes = [
  {
    id: 'node-1',
    position: { x: 100, y: 100 },
    data: { label: 'Test Node 1' },
    type: 'chatNode',
  },
  // Additional test nodes
];

// Edge fixtures
export const testEdges = [
  {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
  },
  // Additional test edges
];

// User fixtures
export const testUsers = [
  {
    id: 'user-1',
    name: 'Test User 1',
    cursor: { x: 150, y: 150 },
  },
  // Additional test users
];
```

### 3. Testing Utilities

We will create testing utilities for:

- Simulating ReactFlow events (node drag, zoom, etc.)
- Simulating Yjs document changes
- Tracking component re-renders
- Measuring performance metrics
- Validating network requests

## Test Cases

### Custom Hook Tests

#### useCanvasNodes

- Test node creation with valid data
- Test node update with partial data
- Test node deletion
- Test batch node operations
- Test error handling for node operations
- Test node selection and deselection
- Test node data validation

#### useNodePositioning

- Test position updates
- Test conflict detection
- Test conflict resolution strategies
- Test position history tracking
- Test optimistic updates
- Test position synchronization with Yjs

#### useYjsIntegration

- Test document initialization
- Test subscription to changes
- Test applying changes from Yjs
- Test sending changes to Yjs
- Test handling connection state changes
- Test document cleanup on unmount

### Component Tests

#### Canvas

- Test rendering with empty state
- Test rendering with nodes and edges
- Test node selection behavior
- Test zoom and pan behavior
- Test minimap interaction
- Test keyboard shortcuts

#### CollaborationOverlay

- Test rendering user cursors
- Test updating cursor positions
- Test connection status indication
- Test offline mode indication
- Test typing indicators

### Integration Tests

- Test node creation flow from UI to Yjs
- Test position update flow
- Test offline and reconnection flow
- Test conflict resolution flow
- Test multi-user editing scenario

## Test Implementation Plan

### Phase 1: Setup and Infrastructure (1 week)

- Create mock implementations for external dependencies
- Set up test fixtures and utilities
- Implement performance measurement tools
- Create test documentation templates

### Phase 2: Custom Hook Testing (2 weeks)

- Implement tests for each custom hook
- Ensure full coverage of hook functionality
- Test error handling and edge cases
- Document test patterns for each hook

### Phase 3: Component Testing (2 weeks)

- Implement tests for each new component
- Test component rendering and interactions
- Test component integration with hooks
- Create snapshot tests for UI regression

### Phase 4: Integration Testing (1 week)

- Implement tests for key user flows
- Test component composition
- Test data flow between components
- Verify service integration

### Phase 5: Collaborative Feature Testing (1 week)

- Implement multi-user test harness
- Test real-time collaboration features
- Test offline behavior and synchronization
- Test conflict resolution

### Phase 6: Performance Testing (1 week)

- Benchmark component rendering performance
- Test with large datasets
- Profile memory usage
- Measure network efficiency

## Continuous Integration

All tests will be integrated into the CI/CD pipeline to:

- Run unit tests on every pull request
- Run integration tests on merge to main branch
- Track test coverage metrics
- Generate performance reports

## Success Criteria

The testing strategy will be considered successful if:

1. Test coverage is >90% for all new code
2. All key user flows are verified by integration tests
3. Performance meets or exceeds the original implementation
4. Collaborative features work reliably in all test scenarios
5. Tests catch regressions before they reach production 