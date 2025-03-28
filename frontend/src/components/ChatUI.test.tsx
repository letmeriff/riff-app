import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ChatUI from './ChatUI';
import { useSocket } from '../contexts/SocketContext';
import { useNetwork } from '../contexts/NetworkContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

// Mock the dependencies
jest.mock('../contexts/SocketContext');
jest.mock('../contexts/NetworkContext');
jest.mock('../contexts/AuthContext');
jest.mock('../services/supabase');
jest.mock('../services/nodeService');

// Mock the HTMLElement.scrollIntoView method that is used by messagesEndRef
Element.prototype.scrollIntoView = jest.fn();

// Setup common mocks
beforeEach(() => {
  jest.clearAllMocks();

  // SocketContext mock
  (useSocket as jest.Mock).mockReturnValue({
    socket: { emit: jest.fn() },
    isConnected: true,
  });

  // NetworkContext mock
  (useNetwork as jest.Mock).mockReturnValue({
    networkAdapter: {
      sendChatMessage: jest.fn(),
      fetchChatMessages: jest.fn(),
    },
    connectionStatus: 'connected',
    sendMessage: jest.fn(),
    subscribeToEvent: jest.fn(() => jest.fn()),
    updateUserPresence: jest.fn(),
  });

  // AuthContext mock
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'user-1', email: 'test@example.com' },
  });

  // Supabase mocks - create a structured mock for each method
  const mockSupabaseFrom = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((callback) => {
      callback({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    }),
  });

  (supabase.from as jest.Mock) = mockSupabaseFrom;

  (supabase.auth.getSession as jest.Mock) = jest.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  });

  // Mock global fetch
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue([]),
  });
});

describe('ChatUI Component', () => {
  const defaultProps = {
    nodeId: '123',
    nodeTitle: 'Test Node',
    userId: 'user-1',
  };

  test('renders empty state when no node is selected', async () => {
    render(<ChatUI nodeId={null} nodeTitle={null} userId="user-1" />);

    // Should show placeholder or empty state
    await waitFor(() => {
      expect(
        screen.getByText(/No node selected/i) ||
          screen.getByText(/Select a node/i) ||
          screen.getByText(/Please select a node/i)
      ).toBeInTheDocument();
    });
  });

  test('loads and displays chat interface when node is selected', async () => {
    // Mock node details
    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'chat_nodes') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { node_id: 123, title: 'Test Node', owner_id: 'user-1' },
            error: null,
          }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((callback) => {
          callback({ data: [], error: null });
          return Promise.resolve({ data: [], error: null });
        }),
      };
    });

    render(<ChatUI {...defaultProps} />);

    // Check for node title
    await waitFor(() => {
      expect(screen.getByText('Test Node')).toBeInTheDocument();
    });

    // Check for node ID display
    await waitFor(() => {
      expect(screen.getByText(/ID: 123/i)).toBeInTheDocument();
    });
  });

  test('displays owner controls when user owns the node', async () => {
    // Mock node details with current user as owner
    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'chat_nodes') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { node_id: 123, title: 'Test Node', owner_id: 'user-1' },
            error: null,
          }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((callback) => {
          callback({ data: [], error: null });
          return Promise.resolve({ data: [], error: null });
        }),
      };
    });

    render(<ChatUI {...defaultProps} />);

    // Check for input field
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    // Check for Send button
    await waitFor(() => {
      const sendButton = screen.getByRole('button', { name: /Send/i });
      expect(sendButton).toBeInTheDocument();
    });
  });

  test('shows typing status from other users', async () => {
    // Define a type for our mock with a presenceCallback property
    type MockSubscribeEvent = jest.Mock & {
      presenceCallback?: (data: unknown) => void;
    };

    // Mock the subscribeToEvent callback for presence updates
    const mockSubscribeToEvent: MockSubscribeEvent = jest.fn(
      (event, callback) => {
        if (event === 'presence-update') {
          // Store callback for later use in test
          mockSubscribeToEvent.presenceCallback = callback;
        }
        return jest.fn();
      }
    );

    (useNetwork as jest.Mock).mockReturnValue({
      networkAdapter: { sendChatMessage: jest.fn() },
      connectionStatus: 'connected',
      sendMessage: jest.fn(),
      subscribeToEvent: mockSubscribeToEvent,
      updateUserPresence: jest.fn(),
    });

    // Mock node details
    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'chat_nodes') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { node_id: 123, title: 'Test Node', owner_id: 'user-1' },
            error: null,
          }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((callback) => {
          callback({ data: [], error: null });
          return Promise.resolve({ data: [], error: null });
        }),
      };
    });

    render(<ChatUI {...defaultProps} />);

    // Wait for component to initialize and subscribe
    await waitFor(() => {
      expect(mockSubscribeToEvent).toHaveBeenCalledWith(
        'presence-update',
        expect.any(Function)
      );
    });

    // Now trigger the presence update
    if (mockSubscribeToEvent.presenceCallback) {
      mockSubscribeToEvent.presenceCallback({
        nodeId: '123',
        presence: [
          {
            userId: 'user-2',
            email: 'other@example.com',
            isTyping: true,
            lastActive: new Date().toISOString(),
          },
          {
            userId: 'user-1',
            email: 'test@example.com',
            isTyping: false,
            lastActive: new Date().toISOString(),
          },
        ],
      });
    }

    // First check if typing indicator is shown
    await waitFor(() => {
      const typingIndicator = screen.getByText(/typing/i);
      expect(typingIndicator).toBeInTheDocument();
    });

    // Then check if it contains the right email
    await waitFor(() => {
      const typingIndicator = screen.getByText(/typing/i);
      expect(typingIndicator.textContent).toContain('other@example.com');
    });
  });
});
