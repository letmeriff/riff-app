import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';

/**
 * Custom render function that includes common providers
 * Add any providers needed for component testing here
 */
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
};

/**
 * Renders a React component with all the necessary providers for testing
 */
const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllTheProviders, ...options });
};

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override render method
export { renderWithProviders as render };
