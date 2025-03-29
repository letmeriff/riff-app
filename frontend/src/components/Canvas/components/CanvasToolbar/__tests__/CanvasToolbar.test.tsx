import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { CanvasToolbar, LayoutType } from './CanvasToolbar';

describe('CanvasToolbar Component', () => {
  const mockOnAddNode = jest.fn();
  const mockOnApplyLayout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders add node button', () => {
    render(<CanvasToolbar onAddNode={mockOnAddNode} />);
    const addNodeButton = screen.getByTestId('add-node-button');
    expect(addNodeButton).toBeInTheDocument();
  });

  it('calls onAddNode when add node button is clicked', () => {
    render(<CanvasToolbar onAddNode={mockOnAddNode} />);
    const addNodeButton = screen.getByTestId('add-node-button');
    fireEvent.click(addNodeButton);
    expect(mockOnAddNode).toHaveBeenCalledTimes(1);
  });

  it('does not render layout button if onApplyLayout is not provided', () => {
    render(<CanvasToolbar onAddNode={mockOnAddNode} />);
    expect(screen.queryByTestId('layout-button')).not.toBeInTheDocument();
  });

  it('renders layout button when onApplyLayout is provided', () => {
    render(
      <CanvasToolbar
        onAddNode={mockOnAddNode}
        onApplyLayout={mockOnApplyLayout}
      />
    );
    const layoutButton = screen.getByTestId('layout-button');
    expect(layoutButton).toBeInTheDocument();
  });

  it('opens layout dropdown when layout button is clicked', () => {
    render(
      <CanvasToolbar
        onAddNode={mockOnAddNode}
        onApplyLayout={mockOnApplyLayout}
      />
    );
    const layoutButton = screen.getByTestId('layout-button');
    fireEvent.click(layoutButton);

    // Check that layout options are visible
    expect(screen.getByTestId('layout-horizontal')).toBeInTheDocument();
    expect(screen.getByTestId('layout-vertical')).toBeInTheDocument();
    expect(screen.getByTestId('layout-grid')).toBeInTheDocument();
    expect(screen.getByTestId('layout-circular')).toBeInTheDocument();
    expect(screen.getByTestId('layout-dagre')).toBeInTheDocument();
  });

  it('calls onApplyLayout with correct layout type when a layout option is selected', () => {
    render(
      <CanvasToolbar
        onAddNode={mockOnAddNode}
        onApplyLayout={mockOnApplyLayout}
      />
    );

    // Open the layout dropdown
    const layoutButton = screen.getByTestId('layout-button');
    fireEvent.click(layoutButton);

    // Click on a layout option
    const horizontalLayout = screen.getByTestId('layout-horizontal');
    fireEvent.click(horizontalLayout);

    // Check that onApplyLayout was called with the correct layout type
    expect(mockOnApplyLayout).toHaveBeenCalledWith('horizontal' as LayoutType);
  });

  it('renders offline indicator when isOffline is true', () => {
    render(<CanvasToolbar onAddNode={mockOnAddNode} isOffline={true} />);

    expect(screen.getByTitle('Offline Mode')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('toggles compact mode when compact toggle button is clicked', () => {
    render(<CanvasToolbar onAddNode={mockOnAddNode} />);

    const toolbar = screen.getByTestId('canvas-toolbar');
    const toggleButton = screen.getByTestId('toggle-compact-button');

    // Initially not compact
    expect(toolbar.className).not.toContain('compact');

    // Click to make compact
    fireEvent.click(toggleButton);
    expect(toolbar.className).toContain('compact');

    // Click to expand
    fireEvent.click(toggleButton);
    expect(toolbar.className).not.toContain('compact');
  });

  it('applies custom position styles', () => {
    const customPosition = { top: 50, left: 100 };
    render(
      <CanvasToolbar onAddNode={mockOnAddNode} position={customPosition} />
    );

    const toolbar = screen.getByTestId('canvas-toolbar');
    expect(toolbar).toHaveStyle('top: 50px');
    expect(toolbar).toHaveStyle('left: 100px');
  });

  it('disables add node and layout buttons when isReadOnly is true', () => {
    render(
      <CanvasToolbar
        onAddNode={mockOnAddNode}
        onApplyLayout={mockOnApplyLayout}
        isReadOnly={true}
      />
    );

    const addNodeButton = screen.getByTestId('add-node-button');
    expect(addNodeButton).toBeDisabled();

    const layoutButton = screen.getByTestId('layout-button');
    expect(layoutButton).toBeDisabled();
  });
});
