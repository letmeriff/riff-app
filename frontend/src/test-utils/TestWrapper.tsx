import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import { YjsProvider } from '../contexts/YjsContext';
import { AuthProvider } from '../contexts/AuthContext';

// Import the mocks
import '../test-utils/mocks/auth.mock';
import '../test-utils/mocks/yjs.mock';
import '../test-utils/mocks/reactflow.mock';

interface TestWrapperProps {
  children: React.ReactNode;
  withYjs?: boolean; 
  withReactFlow?: boolean;
  withAuth?: boolean;
  canvasId?: string;
}

/**
 * TestWrapper component that provides all necessary contexts for testing
 * 
 * This component is used to wrap components in tests with the appropriate
 * context providers. By default, it includes all providers, but you can
 * selectively disable them using the props.
 */
export const TestWrapper: React.FC<TestWrapperProps> = ({
  children,
  withYjs = true,
  withReactFlow = true,
  withAuth = true,
  canvasId = 'test-canvas'
}) => {
  // Initialize with the children
  let wrappedChildren = <>{children}</>;

  // ReactFlow context (outermost wrapper)
  if (withReactFlow) {
    wrappedChildren = (
      <ReactFlowProvider>
        {wrappedChildren}
      </ReactFlowProvider>
    );
  }

  // Yjs context (middle wrapper)
  // Only add YjsProvider if both Yjs and Auth are enabled
  if (withYjs && withAuth) {
    wrappedChildren = (
      <YjsProvider 
        canvasId={canvasId} 
        websocketUrl="ws://localhost:1234"
      >
        {wrappedChildren}
      </YjsProvider>
    );
  } else if (withYjs) {
    console.warn('YjsProvider requires AuthProvider. Enabling AuthProvider to support YjsProvider.');
    // If Yjs is requested but Auth isn't, wrap with both since Yjs depends on Auth
    wrappedChildren = (
      <AuthProvider>
        <YjsProvider 
          canvasId={canvasId} 
          websocketUrl="ws://localhost:1234"
        >
          {wrappedChildren}
        </YjsProvider>
      </AuthProvider>
    );
  }

  // Auth context (innermost wrapper)
  if (withAuth && !withYjs) {
    wrappedChildren = (
      <AuthProvider>
        {wrappedChildren}
      </AuthProvider>
    );
  }

  return wrappedChildren;
};

/**
 * Helper function to render a component with TestWrapper
 */
export const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<TestWrapperProps, 'children'>
) => {
  const { render } = require('@testing-library/react');
  return render(
    <TestWrapper {...options}>
      {ui}
    </TestWrapper>
  );
}; 