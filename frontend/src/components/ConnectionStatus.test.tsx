import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConnectionStatus from './ConnectionStatus';
import { useSocket } from '../contexts/SocketContext';

// Mock the socket context hook
jest.mock('../contexts/SocketContext', () => ({
  useSocket: jest.fn()
}));

// Mock fetch API
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true
  })
);

describe('ConnectionStatus', () => {
  const mockUseSocket = useSocket as jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    mockUseSocket.mockReturnValue({
      connectionStatus: 'connected'
    });
    
    // Avoid timers in tests
    jest.spyOn(window, 'setInterval').mockImplementation(() => 999 as unknown as NodeJS.Timeout);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the online status when connected', () => {
    render(<ConnectionStatus />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });
  
  it('renders connecting status when socket is connecting', () => {
    mockUseSocket.mockReturnValue({
      connectionStatus: 'connecting'
    });
    
    render(<ConnectionStatus />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });
  
  it('renders offline status when disconnected', () => {
    mockUseSocket.mockReturnValue({
      connectionStatus: 'disconnected'
    });
    
    render(<ConnectionStatus />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
  
  it('renders error status when there is a connection error', () => {
    mockUseSocket.mockReturnValue({
      connectionStatus: 'error'
    });
    
    render(<ConnectionStatus />);
    expect(screen.getByText('Connection Error')).toBeInTheDocument();
  });
  
  it('shows expanded details when clicked', () => {
    render(<ConnectionStatus />);
    fireEvent.click(screen.getByText('Online'));
    
    expect(screen.getByText('Socket.IO: connected')).toBeInTheDocument();
    expect(screen.getByText(/Supabase:/)).toBeInTheDocument();
    expect(screen.getByText(/WebSocket Support:/)).toBeInTheDocument();
  });
  
  it('hides expanded details when clicked again', () => {
    render(<ConnectionStatus />);
    
    // First click to expand
    fireEvent.click(screen.getByText('Online'));
    expect(screen.getByText('Socket.IO: connected')).toBeInTheDocument();
    
    // Second click to collapse
    fireEvent.click(screen.getByText('Online'));
    expect(screen.queryByText('Socket.IO: connected')).not.toBeInTheDocument();
  });
  
  it('checks Supabase connection on mount', () => {
    render(<ConnectionStatus />);
    
    expect(fetch).toHaveBeenCalledWith(
      'https://wezijqqdnoezwaqtybzo.supabase.co/rest/v1/',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: expect.any(String)
        })
      })
    );
    
    // Check that we set up an interval, but don't try to run it
    expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
  });
}); 