import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NodeSettingsModal from './NodeSettingsModal';
import {
  updateNodeTitle,
  updateNodeDescription,
} from '../services/nodeService';

// Mock the dependencies
jest.mock('../services/nodeService', () => ({
  updateNodeTitle: jest.fn(),
  updateNodeDescription: jest.fn(),
}));

jest.mock('./NodePositionHistory', () => ({
  __esModule: true,
  default: ({ nodeId, limit }: { nodeId: number; limit: number }) => (
    <div data-testid="node-position-history">
      Position history for node {nodeId} (limit: {limit})
    </div>
  ),
}));

describe('NodeSettingsModal Component', () => {
  const mockNode = {
    id: 'node-123',
    data: {
      label: 'Test Node',
      nodeId: 123,
      description: 'This is a test node description',
    },
  };

  const mockProps = {
    show: true,
    onHide: jest.fn(),
    node: mockNode,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders modal when show is true', () => {
    render(<NodeSettingsModal {...mockProps} />);

    // Check if modal title is rendered with node ID
    expect(screen.getByText(/Node Settings \(ID: 123\)/)).toBeInTheDocument();

    // Check if form fields are populated with node data
    expect(screen.getByLabelText('Title')).toHaveValue('Test Node');
    expect(screen.getByLabelText('Description')).toHaveValue(
      'This is a test node description'
    );

    // Check if buttons are rendered
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  test("doesn't render modal when show is false", () => {
    render(<NodeSettingsModal {...mockProps} show={false} />);

    // Modal should not be in the document
    expect(screen.queryByText(/Node Settings/)).not.toBeInTheDocument();
  });

  test('shows message when no node is selected', () => {
    render(<NodeSettingsModal {...mockProps} node={null} />);

    // Should show a message that no node is selected
    expect(screen.getByText('No node selected')).toBeInTheDocument();
  });

  test('switches between tabs correctly', async () => {
    render(<NodeSettingsModal {...mockProps} />);

    // Initially, the general tab should be active
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(
      screen.queryByTestId('node-position-history')
    ).not.toBeInTheDocument();

    // Click the Position History tab
    await userEvent.click(screen.getByText('Position History'));

    // General tab content should be hidden
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();

    // Position History tab content should be shown
    expect(screen.getByTestId('node-position-history')).toBeInTheDocument();
    expect(
      screen.getByText('Position history for node 123 (limit: 15)')
    ).toBeInTheDocument();

    // Save button should not be visible on Position History tab
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();

    // Click back to General tab
    await userEvent.click(screen.getByText('General'));

    // General tab content should be shown again
    expect(screen.getByLabelText('Title')).toBeInTheDocument();

    // Save button should be visible again
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  test('updates input fields when typing', async () => {
    render(<NodeSettingsModal {...mockProps} />);

    const titleInput = screen.getByLabelText('Title');
    const descriptionInput = screen.getByLabelText('Description');

    // Change title
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Updated Node Title');
    expect(titleInput).toHaveValue('Updated Node Title');

    // Change description
    await userEvent.clear(descriptionInput);
    await userEvent.type(descriptionInput, 'Updated node description');
    expect(descriptionInput).toHaveValue('Updated node description');
  });

  test('disables save button when title is empty', async () => {
    render(<NodeSettingsModal {...mockProps} />);

    const saveButton = screen.getByText('Save Changes');
    expect(saveButton).not.toBeDisabled();

    // Clear the title
    await userEvent.clear(screen.getByLabelText('Title'));

    // Save button should be disabled
    expect(saveButton).toBeDisabled();
  });

  test('saves node changes successfully', async () => {
    // Mock the service functions to return successfully
    (updateNodeTitle as jest.Mock).mockResolvedValue({});
    (updateNodeDescription as jest.Mock).mockResolvedValue({});

    render(<NodeSettingsModal {...mockProps} />);

    // Update the title and description
    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'New Title');

    await userEvent.clear(screen.getByLabelText('Description'));
    await userEvent.type(
      screen.getByLabelText('Description'),
      'New description'
    );

    // Click save button
    await userEvent.click(screen.getByText('Save Changes'));

    // Verify service calls
    expect(updateNodeTitle).toHaveBeenCalledWith(123, 'New Title');
    expect(updateNodeDescription).toHaveBeenCalledWith(123, 'New description');

    // Success message should appear
    await waitFor(() => {
      expect(screen.getByText('Node updated successfully')).toBeInTheDocument();
    });
  });

  test('handles error when saving fails', async () => {
    // Mock the service functions to reject
    (updateNodeTitle as jest.Mock).mockRejectedValue(
      new Error('Update failed')
    );

    render(<NodeSettingsModal {...mockProps} />);

    // Update the title
    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'New Title');

    // Click save button
    await userEvent.click(screen.getByText('Save Changes'));

    // Error message should appear
    await waitFor(() => {
      expect(
        screen.getByText('Failed to update node. Please try again.')
      ).toBeInTheDocument();
    });
  });

  test('closes modal when close button is clicked', async () => {
    render(<NodeSettingsModal {...mockProps} />);

    // Click the close button
    await userEvent.click(screen.getByText('Close'));

    // onHide should have been called
    expect(mockProps.onHide).toHaveBeenCalledTimes(1);
  });

  test('closes modal when X button is clicked', async () => {
    render(<NodeSettingsModal {...mockProps} />);

    // Click the X button in the header
    await userEvent.click(screen.getByText('×'));

    // onHide should have been called
    expect(mockProps.onHide).toHaveBeenCalledTimes(1);
  });

  test('updates form when node prop changes', () => {
    const { rerender } = render(<NodeSettingsModal {...mockProps} />);

    // Initially, title and description match the first node
    expect(screen.getByLabelText('Title')).toHaveValue('Test Node');

    // Update the node prop
    const updatedNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        label: 'Updated Node',
        description: 'Updated description',
      },
    };

    // Re-render with new node
    rerender(<NodeSettingsModal {...mockProps} node={updatedNode} />);

    // Title and description should be updated
    expect(screen.getByLabelText('Title')).toHaveValue('Updated Node');
    expect(screen.getByLabelText('Description')).toHaveValue(
      'Updated description'
    );
  });
});
