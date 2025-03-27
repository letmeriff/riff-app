import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollaborationOverlay } from '../CollaborationOverlay';
import { useYjsIntegration } from '../../../../../hooks/canvas';

// Mock the canvas hooks
jest.mock('../../../../../hooks/canvas', () => ({
  useYjsIntegration: jest.fn(),
}));

describe('CollaborationOverlay Component', () => {
  const mockForceSync = jest.fn().mockResolvedValue(true);
  const mockConnectedUsers = [
    { userId: 'user1', email: 'user1@example.com', name: 'User 1', isTyping: false, lastActive: new Date().toISOString() },
    { userId: 'user2', email: 'user2@example.com', name: 'User 2', isTyping: true, lastActive: new Date().toISOString() },
  ];
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up the mock implementation for useYjsIntegration
    (useYjsIntegration as jest.Mock).mockReturnValue({
      isConnected: true,
      isOffline: false,
      offlineChangesCount: 0,
      syncStatus: null,
      connectedUsers: mockConnectedUsers,
      forceSync: mockForceSync,
    });
  });
  
  it('renders the connected status when online', () => {
    render(<CollaborationOverlay />);
    
    expect(screen.getByTestId('connected-status')).toBeInTheDocument();
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });
  
  it('renders the disconnected status when offline', () => {
    (useYjsIntegration as jest.Mock).mockReturnValue({
      isConnected: false,
      isOffline: true,
      offlineChangesCount: 3,
      syncStatus: null,
      connectedUsers: [],
      forceSync: mockForceSync,
    });
    
    render(<CollaborationOverlay />);
    
    expect(screen.getByTestId('disconnected-status')).toBeInTheDocument();
    expect(screen.getByText(/Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/3 pending changes/i)).toBeInTheDocument();
  });
  
  it('renders a list of connected users', () => {
    render(<CollaborationOverlay />);
    
    expect(screen.getByTestId('user-list')).toBeInTheDocument();
    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('User 2')).toBeInTheDocument();
  });
  
  it('indicates when a user is typing', () => {
    render(<CollaborationOverlay />);
    
    const userElements = screen.getAllByTestId('user-item');
    
    // User 2 is typing
    expect(userElements[1]).toHaveTextContent(/typing/i);
  });
  
  it('calls forceSync when sync button is clicked', () => {
    (useYjsIntegration as jest.Mock).mockReturnValue({
      isConnected: false,
      isOffline: true,
      offlineChangesCount: 3,
      syncStatus: null,
      connectedUsers: [],
      forceSync: mockForceSync,
    });
    
    render(<CollaborationOverlay />);
    
    fireEvent.click(screen.getByTestId('sync-button'));
    
    expect(mockForceSync).toHaveBeenCalled();
  });
  
  it('displays sync status when available', () => {
    (useYjsIntegration as jest.Mock).mockReturnValue({
      isConnected: true,
      isOffline: false,
      offlineChangesCount: 0,
      syncStatus: 'Synced at 10:30 AM',
      connectedUsers: mockConnectedUsers,
      forceSync: mockForceSync,
    });
    
    render(<CollaborationOverlay />);
    
    expect(screen.getByText('Synced at 10:30 AM')).toBeInTheDocument();
  });
  
  it('disables sync button during syncing', () => {
    (useYjsIntegration as jest.Mock).mockReturnValue({
      isConnected: true,
      isOffline: false,
      offlineChangesCount: 0,
      syncStatus: 'Syncing',
      connectedUsers: mockConnectedUsers,
      forceSync: mockForceSync,
    });
    
    render(<CollaborationOverlay />);
    
    expect(screen.getByTestId('sync-button')).toBeDisabled();
  });
  
  it('positions the component according to props', () => {
    render(<CollaborationOverlay position={{ top: 20, right: 30 }} />);
    
    const container = screen.getByTestId('collaboration-overlay');
    expect(container).toHaveStyle('top: 20px');
    expect(container).toHaveStyle('right: 30px');
  });
  
  it('renders minimized when specified', () => {
    render(<CollaborationOverlay minimized />);
    
    expect(screen.getByTestId('collaboration-overlay')).toHaveClass('minimized');
  });
  
  it('toggles between minimized and expanded states', () => {
    render(<CollaborationOverlay />);
    
    // Initially expanded
    expect(screen.getByTestId('collaboration-overlay')).not.toHaveClass('minimized');
    
    // Click to minimize
    fireEvent.click(screen.getByTestId('toggle-button'));
    expect(screen.getByTestId('collaboration-overlay')).toHaveClass('minimized');
    
    // Click to expand
    fireEvent.click(screen.getByTestId('toggle-button'));
    expect(screen.getByTestId('collaboration-overlay')).not.toHaveClass('minimized');
  });
}); 