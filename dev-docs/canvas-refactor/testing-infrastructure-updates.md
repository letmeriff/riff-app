# Canvas Testing Infrastructure Updates

## Overview

As part of implementing the Canvas refactoring testing strategy, we've made several updates to the testing infrastructure to support the new component architecture. This document outlines the changes made and provides guidance for writing tests for the refactored Canvas components.

## Major Changes

### 1. React 18 Testing Compatibility

- Updated hook tests to use `renderHook` from `@testing-library/react` instead of `@testing-library/react-hooks`
- Added better support for async testing patterns using React 18's act() with Promises
- Updated test patterns to be compatible with React 18's concurrent rendering

### 2. CSS Module Support

- Added CSS module mocking in Jest configuration
- Updated the module mapper in package.json to properly handle CSS imports
- Added identity-obj-proxy for CSS module support

### 3. Context Providers for Tests

- Created a reusable `TestWrapper` component in `src/test-utils/TestWrapper.tsx`
- Added support for all necessary contexts:
  - YjsProvider for collaborative editing
  - ReactFlowProvider for canvas rendering
  - AuthProvider for authentication
- Provided helper function `renderWithProviders` for easier test setup

### 4. Improved Mocks

- Updated ReactFlow mocks to better simulate the actual component behavior
- Enhanced Yjs mocks to properly handle collaborative editing features
- Centralized mocks through index exports for easier imports

## How to Use

### Testing Components That Use Hooks

For testing components that use the Canvas hooks:

```tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils/TestWrapper';
import YourComponent from './YourComponent';

describe('YourComponent', () => {
  it('renders correctly', () => {
    renderWithProviders(<YourComponent />);
    expect(screen.getByText('Your Content')).toBeInTheDocument();
  });
});
```

### Testing Hooks

For testing hooks directly:

```tsx
import { renderHook, act } from '@testing-library/react';
import { TestWrapper } from '../../test-utils/TestWrapper';
import { useYourHook } from '../useYourHook';

describe('useYourHook', () => {
  it('initializes with default values', () => {
    const wrapper = ({ children }) => <TestWrapper>{children}</TestWrapper>;

    const { result } = renderHook(() => useYourHook(), { wrapper });
    expect(result.current.value).toBe(expectedValue);
  });
});
```

### Selectively Enabling Contexts

You can selectively enable or disable specific contexts:

```tsx
// Only with Yjs context
renderWithProviders(<YourComponent />, {
  withAuth: false,
  withReactFlow: false,
});

// Only with ReactFlow context
renderWithProviders(<YourComponent />, {
  withAuth: false,
  withYjs: false,
});
```

## Common Testing Patterns

### Testing Node Interactions

```tsx
it('handles node selection', () => {
  renderWithProviders(<Canvas {...mockProps} />);

  // Use the mock trigger from the ReactFlow mock
  fireEvent.click(screen.getByTestId('trigger-node-click'));

  expect(mockProps.onNodeClick).toHaveBeenCalled();
});
```

### Testing Edge Interactions

```tsx
it('creates connections between nodes', () => {
  renderWithProviders(<Canvas {...mockProps} />);

  // Use the mock trigger from the ReactFlow mock
  fireEvent.click(screen.getByTestId('trigger-connect'));

  expect(mockProps.onConnect).toHaveBeenCalled();
});
```

### Testing Yjs Collaboration

```tsx
it('syncs changes via Yjs', async () => {
  // Use a specific canvasId for testing
  renderWithProviders(<YourComponent />, { canvasId: 'test-sync-canvas' });

  // Test collaboration features
  await act(async () => {
    // Perform actions that trigger Yjs updates
  });

  // Verify the synchronized state
});
```

## Troubleshooting

### Missing YjsProvider Context

If you see the error `useYjs must be used within a YjsProvider`, make sure you're using `renderWithProviders` or manually wrapping your component with `YjsProvider`.

### CSS Module Errors

If you see errors related to CSS imports, ensure that your Jest configuration includes the CSS module mapper and that you're using the latest setup.

### Mock Issues

If the ReactFlow or Yjs mocks aren't working as expected, ensure that you're importing them before rendering the component:

```tsx
// Import mocks before tests
import '../../test-utils/mocks/reactflow.mock';
import '../../test-utils/mocks/yjs.mock';
```

## Conclusion

These testing infrastructure updates provide a more maintainable, type-safe, and consistent approach to testing the refactored Canvas components. By using the provided utilities and patterns, you can ensure that the Canvas functionality remains stable as we continue to develop new features.
