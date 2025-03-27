import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FloatingMenu from './FloatingMenu';
import CreateNodeModal from './CreateNodeModal';

// Mock the CreateNodeModal component
jest.mock('./CreateNodeModal', () => jest.fn(
  ({ isOpen, onClose, onCreate }) => isOpen ? (
    <div data-testid="create-node-modal">
      <button onClick={() => onClose()}>Close</button>
      <button onClick={() => onCreate('Test Node', 'gpt-4', 'creative')}>Create</button>
    </div>
  ) : null
));

describe('FloatingMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CreateNodeModal as jest.Mock).mockClear();
  });

  it('renders a Create Node button', () => {
    const onCreateNode = jest.fn();
    render(<FloatingMenu onCreateNode={onCreateNode} />);
    
    expect(screen.getByText('Create Node')).toBeInTheDocument();
  });
  
  it('opens modal when Create Node button is clicked', () => {
    const onCreateNode = jest.fn();
    render(<FloatingMenu onCreateNode={onCreateNode} />);
    
    fireEvent.click(screen.getByText('Create Node'));
    
    expect(screen.getByTestId('create-node-modal')).toBeInTheDocument();
  });
  
  it('closes modal when Close button is clicked', () => {
    const onCreateNode = jest.fn();
    render(<FloatingMenu onCreateNode={onCreateNode} />);
    
    // Open modal
    fireEvent.click(screen.getByText('Create Node'));
    expect(screen.getByTestId('create-node-modal')).toBeInTheDocument();
    
    // Close modal
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('create-node-modal')).not.toBeInTheDocument();
  });
  
  it('calls onCreateNode when a node is created', () => {
    const onCreateNode = jest.fn();
    render(<FloatingMenu onCreateNode={onCreateNode} />);
    
    // Open modal
    fireEvent.click(screen.getByText('Create Node'));
    
    // Create node
    fireEvent.click(screen.getByText('Create'));
    
    expect(onCreateNode).toHaveBeenCalledWith('Test Node', 'gpt-4', 'creative');
  });
  
  it('passes onOpenSettings to CreateNodeModal', () => {
    const onCreateNode = jest.fn();
    const onOpenSettings = jest.fn();
    
    render(
      <FloatingMenu 
        onCreateNode={onCreateNode} 
        onOpenSettings={onOpenSettings} 
      />
    );
    
    // Check that CreateNodeModal was rendered with onOpenSettings prop
    expect(CreateNodeModal).toHaveBeenCalledWith(
      expect.objectContaining({
        onOpenSettings
      }),
      expect.anything()
    );
  });
}); 