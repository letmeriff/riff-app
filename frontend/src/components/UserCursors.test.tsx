import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserCursors from './UserCursors';
import { useYjs } from '../contexts/YjsContext';

// Mock the YjsContext
jest.mock('../contexts/YjsContext', () => ({
  useYjs: jest.fn(),
}));

describe('UserCursors', () => {
  // Setup mock awareness object for reuse
  const mockAwareness = {
    on: jest.fn(),
    off: jest.fn(),
    getStates: jest.fn().mockReturnValue(new Map()),
  };

  // Type for window extension
  type WindowWithYjs = Window &
    typeof globalThis & {
      yjsWebsocketProvider?: {
        awareness: typeof mockAwareness;
      };
    };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock window.yjsWebsocketProvider with awareness
    (window as WindowWithYjs).yjsWebsocketProvider = {
      awareness: mockAwareness,
    };
  });

  afterEach(() => {
    // Clean up
    delete (window as WindowWithYjs).yjsWebsocketProvider;
  });

  it('renders nothing when feature is not enabled', () => {
    // Mock the useYjs hook to return isFeatureEnabled as false
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: false,
      ydoc: {},
      connectedUsers: [],
    });

    const { container } = render(<UserCursors />);

    // Component should render nothing (null)
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no cursors', () => {
    // Mock the useYjs hook
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      ydoc: { clientID: 123 },
      connectedUsers: [],
    });

    // Mock empty awareness states
    mockAwareness.getStates.mockReturnValue(new Map());

    const { container } = render(<UserCursors />);

    // Component should render nothing (null) when no cursors
    expect(container).toBeEmptyDOMElement();
  });

  it('renders cursor for other users', () => {
    // User IDs for testing
    const currentUserId = '123';
    const otherUserId = '456';

    // Mock the useYjs hook
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      ydoc: { clientID: 111 }, // Current user's client ID
      connectedUsers: [
        { userId: currentUserId, clientId: 111 },
        { userId: otherUserId, clientId: 222 },
      ],
    });

    // Mock awareness with cursor positions
    const mockStates = new Map();
    mockStates.set(111, {
      userId: currentUserId,
      cursor: { x: 100, y: 100 },
    });
    mockStates.set(222, {
      userId: otherUserId,
      cursor: { x: 200, y: 300 },
    });

    mockAwareness.getStates.mockReturnValue(mockStates);

    render(<UserCursors />);

    // Check username label is displayed
    expect(screen.getByText(otherUserId)).toBeInTheDocument();

    // We can check for SVG elements
    const svg = screen.getByRole('img', { hidden: true });
    expect(svg).toBeInTheDocument();
  });

  it('handles awareness change events', () => {
    // Mock the useYjs hook
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      ydoc: { clientID: 111 },
      connectedUsers: [{ userId: 'user1', clientId: 222 }],
    });

    // Initially no cursors
    const mockStates = new Map();
    mockAwareness.getStates.mockReturnValue(mockStates);

    // We store the on method to directly call it later
    const originalOnMethod = mockAwareness.on;

    // Render component which will set up the event handler
    render(<UserCursors />);

    // Verify event listener was registered for 'change' event
    expect(mockAwareness.on).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );

    // Get the handler that was registered
    const [eventName, handler] = originalOnMethod.mock.calls[0];
    expect(eventName).toBe('change');

    // Now simulate an awareness change
    const updatedStates = new Map();
    updatedStates.set(222, {
      userId: 'user1',
      cursor: { x: 250, y: 350 },
    });

    mockAwareness.getStates.mockReturnValue(updatedStates);

    // Call the handler directly
    handler();

    // Force a re-render by rendering again
    render(<UserCursors />);

    // Since the component has now re-rendered, we can test if it shows content
    const userElement = screen.queryByText('user1');
    expect(userElement).not.toBeNull();
  });

  it('cleans up event listeners on unmount', () => {
    // Mock the useYjs hook
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      ydoc: { clientID: 111 },
      connectedUsers: [],
    });

    const { unmount } = render(<UserCursors />);

    // Unmount component
    unmount();

    // Verify event listener was removed
    expect(mockAwareness.off).toHaveBeenCalled();
  });

  it('handles errors gracefully when awareness is missing', () => {
    // Mock the useYjs hook
    (useYjs as jest.Mock).mockReturnValue({
      isFeatureEnabled: true,
      ydoc: { clientID: 111 },
      connectedUsers: [],
    });

    // Remove awareness object
    delete (window as WindowWithYjs).yjsWebsocketProvider;

    // Should not throw error
    const { container } = render(<UserCursors />);

    // Component should render nothing
    expect(container).toBeEmptyDOMElement();
  });
});
