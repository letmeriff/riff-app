import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeControls } from '../NodeControls';
import { useCanvasNodes } from '../../../../../hooks/canvas';

// Mock the canvas hooks
jest.mock('../../../../../hooks/canvas', () => ({
  useCanvasNodes: jest.fn(),
}));

describe('NodeControls Component', () => {
  const mockCreateNode = jest.fn().mockResolvedValue({ id: 'new-node-123' });
  const mockDeleteNode = jest.fn().mockResolvedValue(true);
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up the mock implementation for useCanvasNodes
    (useCanvasNodes as jest.Mock).mockReturnValue({
      createNode: mockCreateNode,
      deleteNode: mockDeleteNode,
      loading: false,
      error: null
    });
  });
  
  it('renders the create node button', () => {
    render(<NodeControls />);
    
    expect(screen.getByTestId('create-node-button')).toBeInTheDocument();
    expect(screen.getByText(/Create Node/i)).toBeInTheDocument();
  });
  
  it('calls createNode when create button is clicked', async () => {
    render(<NodeControls />);
    
    fireEvent.click(screen.getByTestId('create-node-button'));
    
    expect(mockCreateNode).toHaveBeenCalled();
  });
  
  it('shows delete button when a node is selected', () => {
    render(<NodeControls selectedNodeId="node-123" />);
    
    expect(screen.getByTestId('delete-node-button')).toBeInTheDocument();
    expect(screen.getByText(/Delete Node/i)).toBeInTheDocument();
  });
  
  it('hides delete button when no node is selected', () => {
    render(<NodeControls selectedNodeId={null} />);
    
    expect(screen.queryByTestId('delete-node-button')).not.toBeInTheDocument();
  });
  
  it('calls deleteNode when delete button is clicked', async () => {
    render(<NodeControls selectedNodeId="node-123" />);
    
    fireEvent.click(screen.getByTestId('delete-node-button'));
    
    expect(mockDeleteNode).toHaveBeenCalledWith('node-123');
  });
  
  it('calls onNodeSelect when a node is deleted', async () => {
    const mockOnNodeSelect = jest.fn();
    render(<NodeControls selectedNodeId="node-123" onNodeSelect={mockOnNodeSelect} />);
    
    fireEvent.click(screen.getByTestId('delete-node-button'));
    
    // Wait for the async operation to complete
    await screen.findByTestId('create-node-button');
    
    // After deleting, selection should be cleared
    expect(mockOnNodeSelect).toHaveBeenCalledWith(null);
  });
  
  it('renders a loading state when nodes are loading', () => {
    (useCanvasNodes as jest.Mock).mockReturnValue({
      createNode: mockCreateNode,
      deleteNode: mockDeleteNode,
      loading: true,
      error: null
    });
    
    render(<NodeControls />);
    
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
  });
  
  it('renders an error message when there is an error', () => {
    const errorMessage = 'Failed to load nodes';
    (useCanvasNodes as jest.Mock).mockReturnValue({
      createNode: mockCreateNode,
      deleteNode: mockDeleteNode,
      loading: false,
      error: new Error(errorMessage)
    });
    
    render(<NodeControls />);
    
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
  
  it('disables buttons when in read-only mode', () => {
    render(<NodeControls readOnly={true} />);
    
    expect(screen.getByTestId('create-node-button')).toBeDisabled();
  });
  
  it('positions the element based on the position prop', () => {
    render(<NodeControls position={{ top: 10, left: 20 }} />);
    
    const container = screen.getByTestId('node-controls-container');
    expect(container).toHaveStyle('top: 10px');
    expect(container).toHaveStyle('left: 20px');
  });
}); 