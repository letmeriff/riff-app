# Riff Test Examples

This document provides examples of tests for different components and features in the Riff application. Use these as reference when writing new tests.

## Table of Contents

1. [Backend Tests](#backend-tests)
   - [API Endpoint Tests](#api-endpoint-tests)
   - [Service Tests](#service-tests)
   - [Authentication Tests](#authentication-tests)
   - [WebSocket Tests](#websocket-tests)
2. [Frontend Tests](#frontend-tests)
   - [Component Tests](#component-tests)
   - [Hook Tests](#hook-tests)
   - [State Management Tests](#state-management-tests)
   - [API Client Tests](#api-client-tests)
3. [Integration Tests](#integration-tests)
4. [End-to-End Tests](#end-to-end-tests)

## Backend Tests

### API Endpoint Tests

Example of testing a REST API endpoint:

```typescript
import request from 'supertest';
import { app } from '../app';
import { supabase } from '../config/supabase';

jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn()
  }
}));

describe('Node API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('GET /api/nodes/:id returns a node', async () => {
    // Mock authentication
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    });
    
    // Mock database query
    (supabase.from as jest.Mock)().select().eq().single.mockResolvedValue({
      data: {
        id: 'node-1',
        content: 'Test Node',
        position: { x: 100, y: 100 }
      },
      error: null
    });
    
    // Send request
    const response = await request(app)
      .get('/api/nodes/node-1')
      .set('Authorization', 'Bearer valid-token');
    
    // Assertions
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'node-1',
      content: 'Test Node',
      position: { x: 100, y: 100 }
    });
  });
  
  it('POST /api/nodes creates a new node', async () => {
    // Mock authentication
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    });
    
    // Mock database insert
    (supabase.from as jest.Mock)().insert().mockResolvedValue({
      data: {
        id: 'new-node-1',
        content: 'New Node',
        position: { x: 200, y: 200 }
      },
      error: null
    });
    
    // Send request
    const response = await request(app)
      .post('/api/nodes')
      .set('Authorization', 'Bearer valid-token')
      .send({
        content: 'New Node',
        position: { x: 200, y: 200 }
      });
    
    // Assertions
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 'new-node-1',
      content: 'New Node',
      position: { x: 200, y: 200 }
    });
  });
});
```

### Service Tests

Example of testing a service with database interactions:

```typescript
import { CanvasService } from './canvasService';
import { supabase } from '../config/supabase';

jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('CanvasService', () => {
  const canvasService = new CanvasService();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('getCanvasById returns a canvas when found', async () => {
    // Mock the database response
    (supabase.from as jest.Mock)().select().eq().single.mockResolvedValue({
      data: {
        id: 'canvas-1',
        name: 'Test Canvas',
        owner_id: 'user-1'
      },
      error: null
    });
    
    // Call the service
    const result = await canvasService.getCanvasById('canvas-1', 'user-1');
    
    // Assertions
    expect(result).toEqual({
      id: 'canvas-1',
      name: 'Test Canvas',
      owner_id: 'user-1'
    });
    expect(supabase.from).toHaveBeenCalledWith('canvases');
  });
  
  it('returns null when canvas is not found', async () => {
    // Mock the database response for not found
    (supabase.from as jest.Mock)().select().eq().single.mockResolvedValue({
      data: null,
      error: { message: 'Canvas not found' }
    });
    
    // Call the service
    const result = await canvasService.getCanvasById('non-existent', 'user-1');
    
    // Assertions
    expect(result).toBeNull();
  });
});
```

### Authentication Tests

Example of testing an authentication middleware:

```typescript
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './auth';
import { supabase } from '../config/supabase';

jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn()
    }
  }
}));

describe('authMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  
  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
    
    jest.clearAllMocks();
  });
  
  it('returns 401 if no token is provided', async () => {
    await authMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );
    
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(nextFunction).not.toHaveBeenCalled();
  });
  
  it('returns 401 if token is invalid', async () => {
    mockRequest.headers = { authorization: 'Bearer invalid-token' };
    
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' }
    });
    
    await authMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );
    
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(nextFunction).not.toHaveBeenCalled();
  });
  
  it('calls next if token is valid', async () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    mockRequest.headers = { authorization: 'Bearer valid-token' };
    
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user },
      error: null
    });
    
    await authMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );
    
    expect(mockRequest.user).toEqual(user);
    expect(nextFunction).toHaveBeenCalled();
  });
});
```

### WebSocket Tests

Example of testing a WebSocket server:

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { startWebSocketServer, handleConnection } from './websocketServer';

jest.mock('ws', () => {
  const mockWebSocket = {
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1 // WebSocket.OPEN
  };
  
  const mockServer = {
    on: jest.fn(),
    close: jest.fn(),
    clients: new Set([mockWebSocket])
  };
  
  return {
    WebSocket: jest.fn(() => mockWebSocket),
    WebSocketServer: jest.fn(() => mockServer),
    OPEN: 1
  };
});

describe('WebSocket Server', () => {
  let mockServer: any;
  let mockHttpServer: any;
  let mockSocket: any;
  
  beforeEach(() => {
    mockServer = new WebSocketServer();
    mockSocket = new WebSocket('ws://localhost:8080');
    mockHttpServer = {
      on: jest.fn()
    };
    
    jest.clearAllMocks();
  });
  
  it('sets up connection handler when server starts', () => {
    startWebSocketServer(mockHttpServer);
    
    expect(WebSocketServer).toHaveBeenCalled();
    expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });
  
  it('registers message and close handlers when client connects', () => {
    handleConnection(mockSocket, { url: '/ws' });
    
    expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
  });
  
  it('broadcasts messages to all clients', () => {
    handleConnection(mockSocket, { url: '/ws' });
    
    // Extract message handler
    const messageHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'message'
    )[1];
    
    // Simulate a message
    messageHandler(JSON.stringify({ type: 'chat', content: 'Hello' }));
    
    // Check if message was broadcast
    expect(mockSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('Hello')
    );
  });
});
```

## Frontend Tests

### Component Tests

Example of testing a React component with React Testing Library:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Node } from './Node';

describe('Node Component', () => {
  it('renders with the correct content', () => {
    const mockNode = {
      id: 'node-1',
      data: { content: 'Test Content' },
      position: { x: 100, y: 100 }
    };
    
    render(<Node node={mockNode} />);
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
  
  it('calls the onClick handler when clicked', () => {
    const mockNode = {
      id: 'node-1',
      data: { content: 'Test Content' },
      position: { x: 100, y: 100 }
    };
    const handleClick = jest.fn();
    
    render(<Node node={mockNode} onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('Test Content'));
    
    expect(handleClick).toHaveBeenCalledWith('node-1');
  });
  
  it('applies the selected class when selected prop is true', () => {
    const mockNode = {
      id: 'node-1',
      data: { content: 'Test Content' },
      position: { x: 100, y: 100 }
    };
    
    render(<Node node={mockNode} selected={true} />);
    
    const nodeElement = screen.getByText('Test Content').closest('div');
    expect(nodeElement).toHaveClass('selected');
  });
});
```

### Hook Tests

Example of testing a custom React hook:

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useCanvas } from './useCanvas';
import { canvasService } from '../services/canvasService';

jest.mock('../services/canvasService', () => ({
  canvasService: {
    getCanvas: jest.fn(),
    updateNode: jest.fn(),
    createNode: jest.fn()
  }
}));

describe('useCanvas Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('loads canvas data on initialization', async () => {
    const mockCanvas = {
      id: 'canvas-1',
      nodes: [{ id: 'node-1', data: { content: 'Node 1' } }],
      edges: []
    };
    
    (canvasService.getCanvas as jest.Mock).mockResolvedValue(mockCanvas);
    
    const { result, waitForNextUpdate } = renderHook(() => 
      useCanvas('canvas-1')
    );
    
    expect(result.current.loading).toBe(true);
    
    await waitForNextUpdate();
    
    expect(result.current.loading).toBe(false);
    expect(result.current.canvas).toEqual(mockCanvas);
    expect(result.current.nodes).toEqual(mockCanvas.nodes);
  });
  
  it('updates a node when updateNode is called', async () => {
    const mockCanvas = {
      id: 'canvas-1',
      nodes: [{ id: 'node-1', data: { content: 'Node 1' } }],
      edges: []
    };
    
    (canvasService.getCanvas as jest.Mock).mockResolvedValue(mockCanvas);
    (canvasService.updateNode as jest.Mock).mockResolvedValue({
      id: 'node-1',
      data: { content: 'Updated Node' }
    });
    
    const { result, waitForNextUpdate } = renderHook(() => 
      useCanvas('canvas-1')
    );
    
    await waitForNextUpdate();
    
    act(() => {
      result.current.updateNode('node-1', { content: 'Updated Node' });
    });
    
    await waitForNextUpdate();
    
    expect(result.current.nodes[0].data.content).toBe('Updated Node');
    expect(canvasService.updateNode).toHaveBeenCalledWith(
      'canvas-1',
      'node-1',
      { content: 'Updated Node' }
    );
  });
});
```

### State Management Tests

Example of testing Redux slices or other state management:

```typescript
import { configureStore } from '@reduxjs/toolkit';
import canvasReducer, {
  setCanvas,
  addNode,
  updateNode,
  selectCanvas,
  selectNodes
} from './canvasSlice';

describe('Canvas Slice', () => {
  let store: any;
  
  beforeEach(() => {
    store = configureStore({
      reducer: {
        canvas: canvasReducer
      }
    });
  });
  
  it('should handle initial state', () => {
    expect(selectCanvas(store.getState())).toEqual(null);
    expect(selectNodes(store.getState())).toEqual([]);
  });
  
  it('should handle setting canvas data', () => {
    const mockCanvas = {
      id: 'canvas-1',
      nodes: [{ id: 'node-1', data: { content: 'Node 1' } }],
      edges: []
    };
    
    store.dispatch(setCanvas(mockCanvas));
    
    expect(selectCanvas(store.getState())).toEqual(mockCanvas);
    expect(selectNodes(store.getState())).toEqual(mockCanvas.nodes);
  });
  
  it('should handle adding a node', () => {
    const mockCanvas = {
      id: 'canvas-1',
      nodes: [],
      edges: []
    };
    
    const newNode = {
      id: 'node-1',
      data: { content: 'New Node' },
      position: { x: 100, y: 100 }
    };
    
    store.dispatch(setCanvas(mockCanvas));
    store.dispatch(addNode(newNode));
    
    expect(selectNodes(store.getState())).toContainEqual(newNode);
  });
  
  it('should handle updating a node', () => {
    const initialNode = {
      id: 'node-1',
      data: { content: 'Initial Content' },
      position: { x: 100, y: 100 }
    };
    
    const mockCanvas = {
      id: 'canvas-1',
      nodes: [initialNode],
      edges: []
    };
    
    store.dispatch(setCanvas(mockCanvas));
    
    store.dispatch(updateNode({
      id: 'node-1',
      changes: {
        data: { content: 'Updated Content' }
      }
    }));
    
    const updatedNodes = selectNodes(store.getState());
    expect(updatedNodes[0].data.content).toBe('Updated Content');
  });
});
```

### API Client Tests

Example of testing an API client:

```typescript
import axios from 'axios';
import { apiClient } from './apiClient';

jest.mock('axios');

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('fetches data from the API', async () => {
    const mockData = { id: 'data-1', name: 'Test Data' };
    (axios.get as jest.Mock).mockResolvedValue({ data: mockData });
    
    const result = await apiClient.getData('data-1');
    
    expect(result).toEqual(mockData);
    expect(axios.get).toHaveBeenCalledWith('/api/data/data-1');
  });
  
  it('posts data to the API', async () => {
    const mockData = { name: 'Test Data' };
    const mockResponse = { id: 'data-1', name: 'Test Data' };
    
    (axios.post as jest.Mock).mockResolvedValue({ data: mockResponse });
    
    const result = await apiClient.createData(mockData);
    
    expect(result).toEqual(mockResponse);
    expect(axios.post).toHaveBeenCalledWith('/api/data', mockData);
  });
  
  it('handles errors gracefully', async () => {
    const mockError = new Error('API Error');
    (axios.get as jest.Mock).mockRejectedValue(mockError);
    
    await expect(apiClient.getData('data-1')).rejects.toThrow('API Error');
  });
});
```

## Integration Tests

Example of an integration test for the canvas feature:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CanvasPage } from './CanvasPage';
import { canvasService } from '../services/canvasService';
import { yjsService } from '../services/yjsService';

jest.mock('../services/canvasService', () => ({
  canvasService: {
    getCanvas: jest.fn(),
    updateNode: jest.fn()
  }
}));

jest.mock('../services/yjsService', () => ({
  yjsService: {
    setupYjsDoc: jest.fn().mockReturnValue({
      doc: {
        on: jest.fn(),
        off: jest.fn()
      },
      awareness: {
        on: jest.fn(),
        off: jest.fn()
      }
    }),
    disconnect: jest.fn()
  }
}));

describe('Canvas Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    const mockCanvas = {
      id: 'canvas-1',
      nodes: [
        { id: 'node-1', data: { content: 'Node 1' }, position: { x: 100, y: 100 } }
      ],
      edges: []
    };
    
    (canvasService.getCanvas as jest.Mock).mockResolvedValue(mockCanvas);
  });
  
  it('loads and displays the canvas with nodes', async () => {
    render(<CanvasPage canvasId="canvas-1" />);
    
    // Check loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    // Wait for canvas to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    // Check if node is displayed
    expect(screen.getByText('Node 1')).toBeInTheDocument();
    
    // Check if Yjs was initialized
    expect(yjsService.setupYjsDoc).toHaveBeenCalledWith('canvas-1');
  });
  
  it('updates a node when edited', async () => {
    (canvasService.updateNode as jest.Mock).mockResolvedValue({
      id: 'node-1',
      data: { content: 'Updated Content' },
      position: { x: 100, y: 100 }
    });
    
    render(<CanvasPage canvasId="canvas-1" />);
    
    // Wait for canvas to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    // Find and click the node
    fireEvent.click(screen.getByText('Node 1'));
    
    // Find the edit input and change it
    const editInput = screen.getByRole('textbox');
    fireEvent.change(editInput, { target: { value: 'Updated Content' } });
    fireEvent.blur(editInput);
    
    // Check if update was called
    expect(canvasService.updateNode).toHaveBeenCalledWith(
      'canvas-1',
      'node-1',
      expect.objectContaining({
        data: { content: 'Updated Content' }
      })
    );
    
    // Check if the updated content is displayed
    await waitFor(() => {
      expect(screen.getByText('Updated Content')).toBeInTheDocument();
    });
  });
});
```

## End-to-End Tests

Example of an end-to-end test using Playwright:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Canvas E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForNavigation();
    
    // Go to the canvas page
    await page.goto('/canvas/test-canvas-1');
    
    // Wait for canvas to load
    await page.waitForSelector('.canvas-ready');
  });
  
  test('should display existing nodes', async ({ page }) => {
    // Check if nodes are displayed
    const nodes = await page.$$('.node');
    expect(nodes.length).toBeGreaterThan(0);
    
    // Check if a specific node exists
    const nodeText = await page.textContent('.node:first-child');
    expect(nodeText).toContain('Test Node');
  });
  
  test('should create a new node when the add button is clicked', async ({ page }) => {
    // Count initial nodes
    const initialNodes = await page.$$('.node');
    const initialCount = initialNodes.length;
    
    // Click the add node button
    await page.click('#add-node-button');
    
    // Wait for new node to appear
    await page.waitForSelector(`.node:nth-child(${initialCount + 1})`);
    
    // Count nodes after adding
    const updatedNodes = await page.$$('.node');
    expect(updatedNodes.length).toBe(initialCount + 1);
  });
  
  test('should edit a node when double-clicked', async ({ page }) => {
    // Double-click the first node
    await page.dblclick('.node:first-child');
    
    // Wait for the edit input to appear
    await page.waitForSelector('.node-edit-input');
    
    // Change the content
    await page.fill('.node-edit-input', 'Updated Node Content');
    
    // Click away to save
    await page.click('.canvas-container');
    
    // Verify the content was updated
    const nodeText = await page.textContent('.node:first-child');
    expect(nodeText).toContain('Updated Node Content');
  });
  
  test('should connect nodes when using the connect tool', async ({ page }) => {
    // Count initial edges
    const initialEdges = await page.$$('.edge');
    const initialEdgeCount = initialEdges.length;
    
    // Enable connect tool
    await page.click('#connect-tool-button');
    
    // Click first node (source)
    await page.click('.node:first-child');
    
    // Click second node (target)
    await page.click('.node:nth-child(2)');
    
    // Wait for the new edge to appear
    await page.waitForSelector(`.edge:nth-child(${initialEdgeCount + 1})`);
    
    // Count edges after connecting
    const updatedEdges = await page.$$('.edge');
    expect(updatedEdges.length).toBe(initialEdgeCount + 1);
  });
});
```