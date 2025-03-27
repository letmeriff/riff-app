import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
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
    jest.spyOn(window, 'setInterval').mockImplementation(() => 999 as any);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the online status when connected', async () => {
    await act(async () => {
      render(<ConnectionStatus />);
    });
    
    expect(screen.getByText('Online')).toBeInTheDocument();
  });
  
  it('renders connecting status when socket is connecting', async () => {
    mockUseSocket.mockReturnValue({
      connectionStatus: 'connecting'
    });
    
    await act(async () => {
      render(<ConnectionStatus />);
    });
    
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });
  
  it('renders offline status when disconnected', async () => {
    mockUseSocket.mockReturnValue({
      connectionStatus: 'disconnected'
    });
    
    await act(async () => {
      render(<ConnectionStatus />);
    });
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
  
  it('renders error status when there is a connection error', async () => {
    mockUseSocket.mockReturnValue({
      connectionStatus: 'error'
    });
    
    await act(async () => {
      render(<ConnectionStatus />);
    });
    
    expect(screen.getByText('Connection Error')).toBeInTheDocument();
  });
  
  it('shows expanded details when clicked', async () => {
    await act(async () => {
      render(<ConnectionStatus />);
    });
    
    await act(async () => {
      fireEvent.click(screen.getByText('Online'));
    });
    
    expect(screen.getByText('Socket.IO: connected')).toBeInTheDocument();
    expect(screen.getByText(/Supabase:/)).toBeInTheDocument();
    expect(screen.getByText(/WebSocket Support:/)).toBeInTheDocument();
  });
  
  it('hides expanded details when clicked again', async () => {
    await act(async () => {
      render(<ConnectionStatus />);
    });
    
    // First click to expand
    await act(async () => {
      fireEvent.click(screen.getByText('Online'));
    });
    
    expect(screen.getByText('Socket.IO: connected')).toBeInTheDocument();
    
    // Second click to collapse
    await act(async () => {
      fireEvent.click(screen.getByText('Online'));
    });
    
    expect(screen.queryByText('Socket.IO: connected')).not.toBeInTheDocument();
  });
  
  it('checks Supabase connection on mount', async () => {
    await act(async () => {
      render(<ConnectionStatus />);
    });
    
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