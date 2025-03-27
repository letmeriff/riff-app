import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ChatNode from './ChatNode';
import { NodeProps } from 'reactflow';

// Mock the dependencies
jest.mock('reactflow', () => ({
  Handle: ({ type, position, style }: { type: string; position: string; style: React.CSSProperties }) => (
    <div data-testid={`handle-${type}-${position}`} style={style} />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
  useUpdateNodeInternals: () => jest.fn(),
}));

// Define a type that matches what our mock expects
interface NodeSettingsProps {
  show: boolean;
  onHide: () => void;
  node: { id: string } | null;
}

jest.mock('./NodeSettingsModal', () => ({
  __esModule: true,
  default: ({ show, node }: NodeSettingsProps) => (
    show ? <div data-testid="node-settings-modal">Settings Modal for {node?.id}</div> : null
  ),
}));

jest.mock('./EditIndicator', () => ({
  __esModule: true,
  default: ({ nodeId }: { nodeId: string }) => (
    <div data-testid="edit-indicator">Edit Indicator for {nodeId}</div>
  ),
}));

jest.mock('../contexts/YjsContext', () => ({
  useYjs: () => ({
    isFeatureEnabled: true,
    updateAwareness: jest.fn(),
  }),
}));

// Use a more specific type for our props that includes all the fields we need
interface ChatNodeData {
  label: string;
  nodeId: number;
  users?: Array<{ userId: string; email: string; isTyping: boolean; lastActive: string }>;
  pulledConnections?: Array<{ nodeId: string; hasUpdates: boolean; pullId?: number }>;
  pulledByConnections?: Array<{ nodeId: string; pullId?: number }>;
  attachments?: Array<{ attachment_id: number; file_url: string; file_type: string }>;
}

type TestNodeProps = NodeProps<ChatNodeData>;

describe('ChatNode Component', () => {
  const mockNodeProps: TestNodeProps = {
    id: 'node-1',
    type: 'chatNode',
    position: { x: 0, y: 0 },
    selected: false,
    data: {
      label: 'Test Node',
      nodeId: 123,
      users: [
        { userId: 'user1', email: 'user1@example.com', isTyping: false, lastActive: new Date().toISOString() },
        { userId: 'user2', email: 'user2@example.com', isTyping: true, lastActive: new Date().toISOString() },
      ],
      pulledConnections: [
        { nodeId: '456', hasUpdates: true, pullId: 1 },
        { nodeId: '789', hasUpdates: false, pullId: 2 },
      ],
      pulledByConnections: [
        { nodeId: '321', pullId: 3 },
      ],
      attachments: [
        { attachment_id: 1, file_url: 'https://example.com/file.pdf', file_type: 'pdf' },
      ],
    },
    dragging: false,
    dragHandle: undefined,
    isConnectable: true,
    zIndex: 1,
    xPos: 0,
    yPos: 0,
  };

  test('renders node with correct content', () => {
    render(<ChatNode {...mockNodeProps} />);
    
    // Check if the node contains the label
    expect(screen.getByText('Test Node')).toBeInTheDocument();
    
    // Check if the node ID is displayed
    expect(screen.getByText('ID: 123')).toBeInTheDocument();
    
    // Check if handles are rendered
    expect(screen.getByTestId('handle-target-top')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-bottom')).toBeInTheDocument();
    
    // Check if user presence indicators are rendered
    expect(screen.getByTitle('user1@example.com')).toBeInTheDocument();
    expect(screen.getByTitle('user2@example.com (typing...)')).toBeInTheDocument();
    
    // Check if pulled connections are rendered
    expect(screen.getByText('Pulls from:')).toBeInTheDocument();
    expect(screen.getByText('Node 456')).toBeInTheDocument();
    expect(screen.getByText('Node 789')).toBeInTheDocument();
    
    // Check if pulled by connections are rendered
    expect(screen.getByText('Pulled by:')).toBeInTheDocument();
    expect(screen.getByText('Node 321')).toBeInTheDocument();
    
    // Check if attachments are rendered
    expect(screen.getByText('Attachments:')).toBeInTheDocument();
    expect(screen.getByTitle('Attachment: PDF')).toBeInTheDocument();
    
    // Check if the edit indicator is rendered when Yjs is enabled
    expect(screen.getByTestId('edit-indicator')).toBeInTheDocument();
  });

  test('opens settings modal on double-click', () => {
    render(<ChatNode {...mockNodeProps} />);
    
    // Settings modal should not be visible initially
    expect(screen.queryByTestId('node-settings-modal')).not.toBeInTheDocument();
    
    // Double-click on the node
    const nodeElement = screen.getByText('Test Node').parentElement;
    if (nodeElement) {
      fireEvent.doubleClick(nodeElement);
    }
    
    // Settings modal should now be visible
    expect(screen.getByTestId('node-settings-modal')).toBeInTheDocument();
    expect(screen.getByText('Settings Modal for node-1')).toBeInTheDocument();
  });

  test('renders node with minimal data', () => {
    const minimalProps: TestNodeProps = {
      ...mockNodeProps,
      data: {
        label: 'Minimal Node',
        nodeId: 456,
      },
    };
    
    render(<ChatNode {...minimalProps} />);
    
    // Check if the node contains the label
    expect(screen.getByText('Minimal Node')).toBeInTheDocument();
    
    // Check if the node ID is displayed
    expect(screen.getByText('ID: 456')).toBeInTheDocument();
    
    // Check that optional elements are not rendered
    expect(screen.queryByText('Pulls from:')).not.toBeInTheDocument();
    expect(screen.queryByText('Pulled by:')).not.toBeInTheDocument();
    expect(screen.queryByText('Attachments:')).not.toBeInTheDocument();
  });

  test('renders initials for user presence', () => {
    render(<ChatNode {...mockNodeProps} />);
    
    // User1's initial should be U
    const userElements = screen.getAllByTitle(/user\d@example.com/);
    
    // The first user (not typing) should just have the initial
    expect(userElements[0].textContent).toBe('U');
    
    // The second user (typing) has the initial plus the typing indicator (✎)
    // We'll just check that it starts with 'U' since the exact content depends on the implementation
    expect(userElements[1].textContent?.startsWith('U')).toBe(true);
  });
}); 