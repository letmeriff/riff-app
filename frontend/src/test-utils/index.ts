/**
 * Export all test utilities
 */

// Fixtures
export * from './fixtures/userFixtures';
export * from './fixtures/canvasFixtures';
export * from './fixtures/chatFixtures';

// Generators
export * from './generators/canvasGenerator';
export * from './generators/messageGenerator';

// Factories
export * from './factories/canvasFactory';

// Helpers
export * from './helpers/renderWithProviders';
export * from './helpers/reactFlowTestUtils';

// Main exports
import React, { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';

// Define a common wrapper props interface
interface WrapperProps {
  children?: ReactNode;
}

// Type for the provider component
type ProviderComponent = React.ComponentType<WrapperProps>;

/**
 * Create a test wrapper with specified context providers
 */
export function createTestWrapper(providers: ProviderComponent[]) {
  return function Wrapper({ children }: WrapperProps) {
    // Simplify the approach to avoid typing issues - wrap each provider around the children
    return providers.reduceRight((wrapped, Provider) => {
      // Safe cast of the provider component
      return React.createElement(Provider, {}, wrapped);
    }, children as React.ReactElement);
  };
}

/**
 * Common wrapper with ReactFlow provider
 */
export function ReactFlowWrapper({ children }: WrapperProps) {
  return React.createElement(ReactFlowProvider, {}, children);
}

/**
 * Custom render function with ReactFlow provider
 */
export function renderWithReactFlow(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: ReactFlowWrapper, ...options });
}

// Re-export testing library
export * from '@testing-library/react';
