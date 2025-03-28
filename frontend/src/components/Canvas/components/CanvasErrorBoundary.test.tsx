/**
 * Tests for CanvasErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CanvasErrorBoundary from './CanvasErrorBoundary';

// Helper components for testing error states
const ErrorComponent = () => {
  throw new Error('Test error');
};

const NormalComponent = () => <div>Normal content</div>;

describe('CanvasErrorBoundary', () => {
  // Suppress console.error during tests
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error occurs', () => {
    render(
      <CanvasErrorBoundary>
        <NormalComponent />
      </CanvasErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('renders error UI when an error occurs', () => {
    render(
      <CanvasErrorBoundary>
        <ErrorComponent />
      </CanvasErrorBoundary>
    );

    expect(screen.getByTestId('canvas-error-boundary')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong in the Canvas')).toBeInTheDocument();
  });

  it('calls onError callback when an error occurs', () => {
    const onErrorMock = jest.fn();
    
    render(
      <CanvasErrorBoundary onError={onErrorMock}>
        <ErrorComponent />
      </CanvasErrorBoundary>
    );

    expect(onErrorMock).toHaveBeenCalled();
  });

  it('renders custom fallback UI when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom Error UI</div>;
    
    render(
      <CanvasErrorBoundary fallback={customFallback}>
        <ErrorComponent />
      </CanvasErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
  });

  it('has a retry button in the error UI', () => {
    render(
      <CanvasErrorBoundary>
        <ErrorComponent />
      </CanvasErrorBoundary>
    );

    // Check if the retry button exists
    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();
  });
  
  // Test handleRetry directly by creating a spy
  it('calls setState when retry button is clicked', () => {
    // Create a spy on the setState method
    const setStateSpy = jest.spyOn(CanvasErrorBoundary.prototype, 'setState');
    
    render(
      <CanvasErrorBoundary>
        <ErrorComponent />
      </CanvasErrorBoundary>
    );
    
    // Click retry button
    fireEvent.click(screen.getByText('Try Again'));
    
    // Check if setState was called with the right arguments
    expect(setStateSpy).toHaveBeenCalledWith({
      hasError: false,
      error: null
    });
    
    // Clean up the spy
    setStateSpy.mockRestore();
  });
}); 