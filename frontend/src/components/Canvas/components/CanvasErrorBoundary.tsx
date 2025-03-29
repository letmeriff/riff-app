/**
 * CanvasErrorBoundary Component
 * 
 * This component serves as an error boundary for the Canvas system,
 * providing graceful degradation and error reporting when something goes wrong.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for Canvas
 * 
 * Provides fallback UI and error reporting for Canvas components
 */
export class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  constructor(props: CanvasErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  /**
   * Update state when an error occurs
   */
  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  /**
   * Log error details when component catches an error
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Canvas Error:', error, errorInfo);
    
    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Try to recover from the error by clearing state
   */
  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default error UI
      return (
        <div
          style={{
            padding: '20px',
            border: '1px solid #ff5555',
            borderRadius: '4px',
            backgroundColor: '#fff8f8',
            color: '#333',
            maxWidth: '800px',
            margin: '0 auto',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
          data-testid="canvas-error-boundary"
        >
          <h3 style={{ color: '#cc0000', margin: '0 0 10px' }}>
            Something went wrong in the Canvas
          </h3>
          
          <div style={{ margin: '10px 0', fontSize: '14px', color: '#666' }}>
            <p>The canvas encountered an error and couldn't be displayed properly.</p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre
                style={{
                  padding: '10px',
                  background: '#f0f0f0',
                  borderRadius: '4px',
                  overflow: 'auto',
                  textAlign: 'left',
                  fontSize: '12px',
                  maxHeight: '150px',
                }}
              >
                {this.state.error.toString()}
              </pre>
            )}
          </div>
          
          <button
            onClick={this.handleRetry}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default CanvasErrorBoundary; 