import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';

interface WrapperProps {
  children?: React.ReactNode;
}

/**
 * Create a test wrapper with specified context providers
 * @param providers Array of provider components with their props
 * @returns A wrapper component for testing
 */
export function createTestWrapper(providers: Array<React.FC<WrapperProps>>) {
  return ({ children }: WrapperProps) => {
    return providers.reduceRight((acc, Provider) => {
      return <Provider>{acc}</Provider>;
    }, <>{children}</>);
  };
}

/**
 * Common wrapper with ReactFlow provider
 */
export const ReactFlowWrapper: React.FC<WrapperProps> = ({ children }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
);

/**
 * Custom render function with ReactFlow provider
 */
export function renderWithReactFlow(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: ReactFlowWrapper, ...options });
} 