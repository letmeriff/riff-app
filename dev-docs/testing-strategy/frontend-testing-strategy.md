# Frontend Testing Strategy

This document outlines the strategy for testing the frontend components of the Riff application.

## Component Testing Approach

The frontend testing strategy focuses on React components, using React Testing Library to verify rendering and interactions from a user-centric perspective.

### Component Hierarchy

We categorize components for testing based on their complexity and responsibilities:

1. **Presentational Components**: Simple UI components with minimal state or behavior
2. **Container Components**: Components that manage state and data flow
3. **Page Components**: Top-level components that combine other components
4. **Custom Hooks**: Reusable hooks with business logic

### Testing Priorities

- **Canvas Components**: Components responsible for the infinite canvas and node placement
- **Chat Components**: Components handling chat UI and message interactions
- **Collaboration Indicators**: Components showing real-time user presence and activity
- **Node and Edge Components**: Components for rendering and interacting with nodes and edges

## Testing Approach By Component Type

### Presentational Components

For simple UI components, focus on:

- Correct rendering with different props
- Accessibility attributes
- Event handling (clicks, keyboard interactions)

Example:

```typescript
// Button component test
describe('Button', () => {
  it('renders correctly', () => {
    const { getByRole } = render(<Button>Click me</Button>);
    const button = getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Click me');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    const { getByRole } = render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    const { getByRole } = render(<Button disabled>Click me</Button>);
    expect(getByRole('button')).toBeDisabled();
  });
});
```

### Container Components

For components managing state:

- Test initial state rendering
- Test state changes after interactions
- Test effects of context or prop changes

Example:

```typescript
// ChatPanel component test
describe('ChatPanel', () => {
  it('displays loading state initially', () => {
    const { getByTestId } = render(<ChatPanel nodeId="node-1" />);
    expect(getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('displays messages when loaded', async () => {
    // Mock API response
    server.use(
      rest.get('/api/nodes/node-1/messages', (req, res, ctx) => {
        return res(
          ctx.json({
            messages: [
              { id: 'msg1', content: 'Hello', sender: 'user' },
              { id: 'msg2', content: 'Hi there', sender: 'ai' },
            ],
          })
        );
      })
    );

    const { findByText } = render(<ChatPanel nodeId="node-1" />);
    expect(await findByText('Hello')).toBeInTheDocument();
    expect(await findByText('Hi there')).toBeInTheDocument();
  });

  it('sends a new message', async () => {
    const sendMessageMock = jest.fn();
    server.use(
      rest.post('/api/nodes/node-1/messages', (req, res, ctx) => {
        sendMessageMock(req.body);
        return res(ctx.json({ success: true }));
      })
    );

    const { getByRole, getByLabelText } = render(<ChatPanel nodeId="node-1" />);

    await userEvent.type(getByLabelText('Message'), 'New message');
    await userEvent.click(getByRole('button', { name: 'Send' }));

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'New message' })
    );
  });
});
```

### Page Components

For page-level components:

- Focus on integration of child components
- Test routing and navigation
- Test data fetching and loading states

Example:

```typescript
// CanvasPage component test
describe('CanvasPage', () => {
  it('renders the canvas and toolbar', () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/canvas/abc123']}>
        <Route path="/canvas/:id">
          <CanvasPage />
        </Route>
      </MemoryRouter>
    );

    expect(getByTestId('canvas')).toBeInTheDocument();
    expect(getByTestId('toolbar')).toBeInTheDocument();
  });

  it('loads canvas data on mount', async () => {
    // Mock canvas data
    server.use(
      rest.get('/api/canvas/abc123', (req, res, ctx) => {
        return res(
          ctx.json({
            id: 'abc123',
            nodes: [{ id: 'node1', position: { x: 100, y: 100 } }],
            edges: [],
          })
        );
      })
    );

    const { findByTestId } = render(
      <MemoryRouter initialEntries={['/canvas/abc123']}>
        <Route path="/canvas/:id">
          <CanvasPage />
        </Route>
      </MemoryRouter>
    );

    // Wait for node to be rendered
    const node = await findByTestId('node-node1');
    expect(node).toBeInTheDocument();
  });
});
```

### Custom Hooks

For hooks with business logic:

- Use `renderHook` from Testing Library
- Test initialization, updates, and cleanup
- Test side effects and error handling

Example:

```typescript
// useChat hook test
describe('useChat', () => {
  it('initializes with empty messages', () => {
    const { result } = renderHook(() => useChat('node-1'));
    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('loads messages on initialization', async () => {
    // Mock API response
    server.use(
      rest.get('/api/nodes/node-1/messages', (req, res, ctx) => {
        return res(
          ctx.json({
            messages: [{ id: 'msg1', content: 'Hello', sender: 'user' }],
          })
        );
      })
    );

    const { result, waitForNextUpdate } = renderHook(() => useChat('node-1'));
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.messages).toEqual([
      { id: 'msg1', content: 'Hello', sender: 'user' },
    ]);
  });

  it('sends a new message', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useChat('node-1'));

    // Mock API response for sending message
    server.use(
      rest.post('/api/nodes/node-1/messages', (req, res, ctx) => {
        return res(
          ctx.json({
            message: { id: 'msg2', content: req.body.content, sender: 'user' },
          })
        );
      })
    );

    // Call the hook's send method
    act(() => {
      result.current.sendMessage('Hello world');
    });

    await waitForNextUpdate();

    expect(result.current.messages).toContainEqual({
      id: 'msg2',
      content: 'Hello world',
      sender: 'user',
    });
  });
});
```

## Canvas-Specific Testing

The canvas is a core component with complex interactions:

### ReactFlow Testing

For ReactFlow components:

- Test node and edge rendering
- Test selection and interaction behavior
- Test panning and zooming functionality

Example:

```typescript
// Canvas component test
describe('Canvas', () => {
  it('renders nodes from props', () => {
    const nodes = [
      { id: 'node1', data: { label: 'Node 1' }, position: { x: 100, y: 100 } },
      { id: 'node2', data: { label: 'Node 2' }, position: { x: 200, y: 200 } },
    ];

    const { getByText } = render(<Canvas nodes={nodes} edges={[]} />);

    expect(getByText('Node 1')).toBeInTheDocument();
    expect(getByText('Node 2')).toBeInTheDocument();
  });

  it('selects a node on click', async () => {
    const nodes = [
      { id: 'node1', data: { label: 'Node 1' }, position: { x: 100, y: 100 } },
    ];
    const onNodeSelect = jest.fn();

    const { getByText } = render(
      <Canvas nodes={nodes} edges={[]} onNodeSelect={onNodeSelect} />
    );

    await userEvent.click(getByText('Node 1'));
    expect(onNodeSelect).toHaveBeenCalledWith('node1');
  });
});
```

### Drag and Drop Testing

For drag and drop interactions:

- Use userEvent for pointer interactions
- Test element positioning after drag operations
- Test connection creation between nodes

Example:

```typescript
// NodeDrag test
describe('Node dragging', () => {
  it('allows dragging a node', async () => {
    const nodes = [
      { id: 'node1', data: { label: 'Node 1' }, position: { x: 100, y: 100 } },
    ];
    const onNodeDragStop = jest.fn();

    const { getByTestId } = render(
      <Canvas nodes={nodes} edges={[]} onNodeDragStop={onNodeDragStop} />
    );

    const node = getByTestId('node-node1');

    // Simulate drag
    await userEvent.pointer([
      { target: node, keys: '[MouseLeft>]', coords: { clientX: 100, clientY: 100 } },
      { coords: { clientX: 150, clientY: 150 } },
      { keys: '[/MouseLeft]' },
    ]);

    expect(onNodeDragStop).toHaveBeenCalledWith(
      expect.anything(),
      'node1',
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number)
      })
    );
  });
});
```

## Mocking Strategy

### API Mocking

Use MSW (Mock Service Worker) to intercept and mock API calls:

```typescript
// src/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // Get canvas data
  rest.get('/api/canvas/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.json({
        id,
        nodes: [
          {
            id: 'node1',
            data: { label: 'Node 1' },
            position: { x: 100, y: 100 },
          },
        ],
        edges: [],
      })
    );
  }),

  // Get node messages
  rest.get('/api/nodes/:id/messages', (req, res, ctx) => {
    return res(
      ctx.json({
        messages: [
          { id: 'msg1', content: 'Hello', sender: 'user' },
          { id: 'msg2', content: 'Hi there', sender: 'ai' },
        ],
      })
    );
  }),

  // Add message
  rest.post('/api/nodes/:id/messages', (req, res, ctx) => {
    const { content } = req.body;
    return res(
      ctx.json({
        message: { id: 'new-msg', content, sender: 'user' },
      })
    );
  }),
];
```

### Socket and WebSocket Mocking

For real-time communication:

```typescript
// Mock Socket.IO
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
  return jest.fn(() => mockSocket);
});

// Mock Y-WebSocket
jest.mock('y-websocket', () => {
  const mockAwareness = {
    setLocalState: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  };

  return {
    WebsocketProvider: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
      awareness: mockAwareness,
      wsconnected: true,
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
  };
});
```

### Context Mocking

For components that rely on React context:

```typescript
// Auth context mock
const mockAuthContext = {
  user: { id: 'user1', name: 'Test User' },
  isAuthenticated: true,
  login: jest.fn(),
  logout: jest.fn(),
};

// Wrap component with context provider
const renderWithAuth = (ui) => {
  return render(
    <AuthContext.Provider value={mockAuthContext}>
      {ui}
    </AuthContext.Provider>
  );
};

// Use in tests
it('shows user name when authenticated', () => {
  const { getByText } = renderWithAuth(<UserProfile />);
  expect(getByText('Test User')).toBeInTheDocument();
});
```

## Integration with Storybook

Use Storybook for component development and visual testing:

- Create stories for each component
- Add interaction tests to stories
- Use for visual regression testing

Example:

```typescript
// Button.stories.tsx
import { Button } from './Button';

export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    onClick: { action: 'clicked' },
  },
};

const Template = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  variant: 'primary',
  children: 'Primary Button',
};

export const Secondary = Template.bind({});
Secondary.args = {
  variant: 'secondary',
  children: 'Secondary Button',
};

export const Disabled = Template.bind({});
Disabled.args = {
  disabled: true,
  children: 'Disabled Button',
};
```

## Test Organization

Organize frontend tests using the following structure:

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── Button.stories.tsx
├── hooks/
│   ├── useChat.ts
│   └── useChat.test.ts
├── pages/
│   ├── CanvasPage/
│   │   ├── CanvasPage.tsx
│   │   └── CanvasPage.test.tsx
├── utils/
│   ├── formatDate.ts
│   └── formatDate.test.ts
```

By following this frontend testing strategy, we ensure comprehensive coverage of the Riff application's UI components while maintaining a focus on user-centric testing.
