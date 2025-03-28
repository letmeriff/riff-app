import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CollaborationStatus from './CollaborationStatus';
import { useYjs } from '../contexts/YjsContext';

// Mock the YjsContext
jest.mock('../contexts/YjsContext', () => ({
  useYjs: jest.fn(),
}));

// Mock ConnectionStatus component since we don't need to test it in this file
jest.mock('./ConnectionStatus', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="connection-status">Standard Connection Status</div>
  ),
}));

describe('CollaborationStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders ConnectionStatus when Yjs feature is not enabled', () => {
    // Mock the useYjs hook to return isFeatureEnabled as false
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: false,
    });

    render(<CollaborationStatus />);

    // Should render the ConnectionStatus component
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
  });

  it('renders collaboration status when connected', () => {
    // Mock the useYjs hook to return connected status with users
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      isConnected: true,
      isOffline: false,
      connectedUsers: [
        { userId: 'user1', clientId: 1 },
        { userId: 'user2', clientId: 2 },
      ],
    });

    render(<CollaborationStatus />);

    // Check status indicator text
    expect(screen.getByText('Collaborating (2 users)')).toBeInTheDocument();
  });

  it('renders connecting status when not connected', () => {
    // Mock the useYjs hook to return connecting status
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      isConnected: false,
      isOffline: false,
      connectedUsers: [],
    });

    render(<CollaborationStatus />);

    // Check status indicator text
    expect(
      screen.getByText('Connecting to collaboration server...')
    ).toBeInTheDocument();
  });

  it('renders offline status correctly', () => {
    // Mock the useYjs hook to return offline status
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      isConnected: false,
      isOffline: true,
      connectedUsers: [],
    });

    render(<CollaborationStatus />);

    // Check status indicator text
    expect(
      screen.getByText('Offline (changes saved locally)')
    ).toBeInTheDocument();
  });

  it('toggles expanded view when clicked', () => {
    // Mock the useYjs hook
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      isConnected: true,
      isOffline: false,
      connectedUsers: [{ userId: 'user1', clientId: 1 }],
    });

    render(<CollaborationStatus />);

    // Initially, expanded view should not be visible
    expect(screen.queryByText('Collaboration Status')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText('Collaborating (1 user)'));

    // Now expanded view should be visible
    expect(screen.getByText('Collaboration Status')).toBeInTheDocument();
    expect(screen.getByText('Connected Users (1)')).toBeInTheDocument();
    expect(screen.getByText('user1')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(screen.getByText('Collaborating (1 user)'));

    // Expanded view should be hidden again
    expect(screen.queryByText('Collaboration Status')).not.toBeInTheDocument();
  });

  it('displays offline message in expanded view when offline', () => {
    // Mock the useYjs hook to return offline status
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      isConnected: false,
      isOffline: true,
      connectedUsers: [],
    });

    render(<CollaborationStatus />);

    // Click to expand
    fireEvent.click(screen.getByText('Offline (changes saved locally)'));

    // Check for offline specific message
    expect(screen.getByText('Offline Mode:')).toBeInTheDocument();
    expect(
      screen.getByText(/Your changes are saved locally/)
    ).toBeInTheDocument();
  });

  it('displays correct connection details in expanded view', () => {
    // Mock the useYjs hook
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      isConnected: true,
      isOffline: false,
      connectedUsers: [{ userId: 'user1', clientId: 1 }],
    });

    render(<CollaborationStatus />);

    // Click to expand
    fireEvent.click(screen.getByText('Collaborating (1 user)'));

    // Check connection details
    expect(screen.getByText('Connection:')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Sync:')).toBeInTheDocument();
    expect(screen.getByText('Real-time')).toBeInTheDocument();
    expect(screen.getByText('Awareness:')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });
});
