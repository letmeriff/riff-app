import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasToolbar } from '../CanvasToolbar';
import { useCanvasUI } from '../../../../../hooks/canvas';

// Mock the canvas hooks
jest.mock('../../../../../hooks/canvas', () => ({
  useCanvasUI: jest.fn(),
}));

describe('CanvasToolbar Component', () => {
  const mockToggleMenu = jest.fn();
  const mockSetViewport = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up the mock implementation for useCanvasUI
    (useCanvasUI as jest.Mock).mockReturnValue({
      isMenuOpen: false,
      toggleMenu: mockToggleMenu,
      setViewport: mockSetViewport,
    });
  });
  
  it('renders the toolbar with basic controls', () => {
    render(<CanvasToolbar />);
    
    expect(screen.getByTestId('canvas-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-in-button')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-out-button')).toBeInTheDocument();
    expect(screen.getByTestId('fit-view-button')).toBeInTheDocument();
  });
  
  it('triggers zoom in when zoom in button is clicked', () => {
    const mockOnZoomIn = jest.fn();
    render(<CanvasToolbar onZoomIn={mockOnZoomIn} />);
    
    fireEvent.click(screen.getByTestId('zoom-in-button'));
    
    expect(mockOnZoomIn).toHaveBeenCalled();
  });
  
  it('triggers zoom out when zoom out button is clicked', () => {
    const mockOnZoomOut = jest.fn();
    render(<CanvasToolbar onZoomOut={mockOnZoomOut} />);
    
    fireEvent.click(screen.getByTestId('zoom-out-button'));
    
    expect(mockOnZoomOut).toHaveBeenCalled();
  });
  
  it('triggers fit view when fit view button is clicked', () => {
    const mockOnFitView = jest.fn();
    render(<CanvasToolbar onFitView={mockOnFitView} />);
    
    fireEvent.click(screen.getByTestId('fit-view-button'));
    
    expect(mockOnFitView).toHaveBeenCalled();
  });
  
  it('toggles menu when menu button is clicked', () => {
    render(<CanvasToolbar />);
    
    fireEvent.click(screen.getByTestId('menu-button'));
    
    expect(mockToggleMenu).toHaveBeenCalled();
  });
  
  it('renders settings button when onOpenSettings is provided', () => {
    const mockOnOpenSettings = jest.fn();
    render(<CanvasToolbar onOpenSettings={mockOnOpenSettings} />);
    
    const settingsButton = screen.getByTestId('settings-button');
    expect(settingsButton).toBeInTheDocument();
    
    fireEvent.click(settingsButton);
    expect(mockOnOpenSettings).toHaveBeenCalled();
  });
  
  it('does not render settings button when onOpenSettings is not provided', () => {
    render(<CanvasToolbar />);
    
    expect(screen.queryByTestId('settings-button')).not.toBeInTheDocument();
  });
  
  it('disables buttons when in read-only mode', () => {
    render(<CanvasToolbar readOnly={true} />);
    
    expect(screen.getByTestId('zoom-in-button')).toBeDisabled();
    expect(screen.getByTestId('zoom-out-button')).toBeDisabled();
    expect(screen.getByTestId('fit-view-button')).not.toBeDisabled(); // Fit view should still be enabled
    expect(screen.getByTestId('menu-button')).toBeDisabled();
  });
  
  it('triggers layout actions when layout button is clicked', () => {
    const mockOnApplyLayout = jest.fn();
    render(<CanvasToolbar onApplyLayout={mockOnApplyLayout} />);
    
    fireEvent.click(screen.getByTestId('layout-button'));
    fireEvent.click(screen.getByTestId('layout-horizontal'));
    
    expect(mockOnApplyLayout).toHaveBeenCalledWith('horizontal');
  });
  
  it('toggles between expanded and compact mode', () => {
    render(<CanvasToolbar />);
    
    // Initially expanded
    expect(screen.getByTestId('canvas-toolbar')).not.toHaveClass('compact');
    
    // Click to toggle
    fireEvent.click(screen.getByTestId('toggle-compact-button'));
    
    // Should be compact now
    expect(screen.getByTestId('canvas-toolbar')).toHaveClass('compact');
  });
  
  it('renders in the specified position', () => {
    render(<CanvasToolbar position={{ left: 50, top: 20 }} />);
    
    const toolbar = screen.getByTestId('canvas-toolbar');
    expect(toolbar).toHaveStyle('left: 50px');
    expect(toolbar).toHaveStyle('top: 20px');
  });
  
  it('defaults to sensible position when none specified', () => {
    render(<CanvasToolbar />);
    
    const toolbar = screen.getByTestId('canvas-toolbar');
    expect(toolbar).toHaveStyle('top: 20px');
    expect(toolbar).toHaveStyle('left: 20px');
  });
}); 