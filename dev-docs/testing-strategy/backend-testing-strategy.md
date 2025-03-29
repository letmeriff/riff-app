# Backend Testing Strategy

This document outlines the strategy for testing the backend components of the Riff application.

## Backend Architecture Overview

The Riff backend consists of several key components:

1. **Express API Server**: RESTful endpoints for CRUD operations
2. **WebSocket Server**: Real-time message broadcasting for collaboration
3. **Yjs WebSocket Server**: Specialized WebSocket server for Yjs sync protocol
4. **Database Layer**: Supabase/PostgreSQL integration for data persistence
5. **Auth Service**: Authentication and authorization
6. **Node Service**: Business logic for chat nodes and AI interactions

## Testing Approach

### Unit Tests (60%)

Focus on testing individual functions and services in isolation:

- **Services**: Business logic and data transformation
- **Utilities**: Helper functions and tools
- **Middleware**: Request processing and validation
- **Models**: Data validation and formatting

### Integration Tests (30%)

Test interactions between components:

- **API Routes**: End-to-end API endpoint tests
- **Database Operations**: CRUD operations with test database
- **Auth Flow**: Authentication and authorization process
- **WebSocket Communication**: Real-time message flow

### Functional Tests (10%)

Test complete backend workflows:

- **Multi-user scenarios**: Simulate multiple connected clients
- **Synchronization flows**: Test document synchronization
- **Error handling**: Test system recovery from failures

## Testing Priorities

1. **Core Data Flow**: CRUD operations for nodes, edges, and messages
2. **Real-time Collaboration**: WebSocket communication and synchronization
3. **Authentication**: User authentication and session management
4. **Error Handling**: Proper error responses and system recovery

## Testing Strategy by Component

### Express API Testing

Test all API endpoints for:

- Request validation
- Response formatting
- Authentication and authorization
- Error handling

Example:

```typescript
// Node API endpoint test
describe('Node API', () => {
  beforeEach(async () => {
    // Set up test database state
    await setupTestDatabase();
  });

  afterEach(async () => {
    // Clean up test database
    await cleanupTestDatabase();
  });

  it('GET /api/nodes/:id returns a node', async () => {
    // Insert test node
    const nodeId = await insertTestNode({
      id: 'test-node',
      data: { content: 'Test content' },
      position: { x: 100, y: 100 },
    });

    // Request the node
    const response = await request(app)
      .get(`/api/nodes/${nodeId}`)
      .set('Authorization', `Bearer ${testToken}`);

    // Assertions
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: nodeId,
      data: { content: 'Test content' },
      position: { x: 100, y: 100 },
    });
  });

  it('POST /api/nodes creates a new node', async () => {
    const nodeData = {
      data: { content: 'New node' },
      position: { x: 200, y: 200 },
    };

    const response = await request(app)
      .post('/api/nodes')
      .set('Authorization', `Bearer ${testToken}`)
      .send(nodeData);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      ...nodeData,
    });

    // Verify it was saved to the database
    const savedNode = await getNodeFromDatabase(response.body.id);
    expect(savedNode).toMatchObject(nodeData);
  });

  it('PATCH /api/nodes/:id updates a node', async () => {
    // Insert test node
    const nodeId = await insertTestNode({
      id: 'test-node',
      data: { content: 'Original content' },
      position: { x: 100, y: 100 },
    });

    const updateData = {
      data: { content: 'Updated content' },
    };

    const response = await request(app)
      .patch(`/api/nodes/${nodeId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: nodeId,
      data: { content: 'Updated content' },
      position: { x: 100, y: 100 },
    });

    // Verify it was updated in the database
    const updatedNode = await getNodeFromDatabase(nodeId);
    expect(updatedNode.data.content).toBe('Updated content');
  });

  it('DELETE /api/nodes/:id deletes a node', async () => {
    // Insert test node
    const nodeId = await insertTestNode({
      id: 'test-node',
      data: { content: 'Test content' },
      position: { x: 100, y: 100 },
    });

    const response = await request(app)
      .delete(`/api/nodes/${nodeId}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(response.status).toBe(204);

    // Verify it was deleted from the database
    const deletedNode = await getNodeFromDatabase(nodeId);
    expect(deletedNode).toBeNull();
  });
});
```

### WebSocket Server Testing

Test WebSocket communication for:

- Connection and disconnection
- Message broadcasting
- Client session management
- Error handling

Example:

```typescript
// WebSocket server test
describe('WebSocket Server', () => {
  let server;
  let clientSocket;

  beforeEach((done) => {
    server = createWebSocketServer();
    clientSocket = createClientSocket();
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    server.close();
  });

  it('broadcasts node position updates to other clients', (done) => {
    const client1 = createClientSocket();
    const client2 = createClientSocket();

    // Wait for both clients to connect
    let connected = 0;
    const onConnect = () => {
      connected++;
      if (connected === 2) {
        // Both clients connected, proceed with test

        // Listen for position update on client2
        client2.on('node-position-update', (data) => {
          expect(data).toMatchObject({
            nodeId: 'test-node',
            position: { x: 200, y: 200 },
          });

          client1.disconnect();
          client2.disconnect();
          done();
        });

        // Emit position update from client1
        client1.emit('node-position-update', {
          nodeId: 'test-node',
          position: { x: 200, y: 200 },
        });
      }
    };

    client1.on('connect', onConnect);
    client2.on('connect', onConnect);
  });

  it('notifies when a user starts typing', (done) => {
    const client1 = createClientSocket();
    const client2 = createClientSocket();

    // Wait for both clients to connect
    let connected = 0;
    const onConnect = () => {
      connected++;
      if (connected === 2) {
        // Both clients connected, proceed with test

        // Listen for typing notification on client2
        client2.on('user-typing', (data) => {
          expect(data).toMatchObject({
            userId: 'user1',
            nodeId: 'test-node',
            isTyping: true,
          });

          client1.disconnect();
          client2.disconnect();
          done();
        });

        // Emit typing event from client1
        client1.emit('user-typing', {
          userId: 'user1',
          nodeId: 'test-node',
          isTyping: true,
        });
      }
    };

    client1.on('connect', onConnect);
    client2.on('connect', onConnect);
  });
});
```

### Yjs WebSocket Server Testing

Test the specialized Yjs WebSocket server:

- Document synchronization
- Update persistence
- Awareness protocol
- Authentication flow

Example:

```typescript
// Yjs WebSocket server test
describe('Yjs WebSocket Server', () => {
  let server;
  let yjsDoc1;
  let yjsDoc2;
  let provider1;
  let provider2;

  beforeEach(async () => {
    // Start the server
    server = await startYjsWebSocketServer();

    // Create Yjs documents and providers
    yjsDoc1 = new Y.Doc();
    yjsDoc2 = new Y.Doc();

    provider1 = new WebsocketProvider(
      'ws://localhost:1234',
      'test-doc',
      yjsDoc1,
      { params: { token: 'valid-token-1' } }
    );

    provider2 = new WebsocketProvider(
      'ws://localhost:1234',
      'test-doc',
      yjsDoc2,
      { params: { token: 'valid-token-2' } }
    );

    // Wait for connection
    await Promise.all([
      new Promise((resolve) =>
        provider1.on('status', ({ status }) => {
          if (status === 'connected') resolve();
        })
      ),
      new Promise((resolve) =>
        provider2.on('status', ({ status }) => {
          if (status === 'connected') resolve();
        })
      ),
    ]);
  });

  afterEach(async () => {
    // Clean up
    provider1.disconnect();
    provider2.disconnect();
    await server.stop();
  });

  it('synchronizes document between clients', async () => {
    // Make a change in the first document
    const nodesMap1 = yjsDoc1.getMap('nodes');
    nodesMap1.set('node1', {
      id: 'node1',
      position: { x: 100, y: 100 },
      data: { content: 'Test node' },
    });

    // Wait for synchronization
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check the second document
    const nodesMap2 = yjsDoc2.getMap('nodes');
    const node = nodesMap2.get('node1');

    expect(node).toMatchObject({
      id: 'node1',
      position: { x: 100, y: 100 },
      data: { content: 'Test node' },
    });
  });

  it('persists updates to the database', async () => {
    // Make a change in the document
    const nodesMap = yjsDoc1.getMap('nodes');
    nodesMap.set('node1', {
      id: 'node1',
      position: { x: 100, y: 100 },
      data: { content: 'Test node' },
    });

    // Wait for persistence
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check the database
    const { data } = await supabase
      .from('yjs_updates')
      .select('*')
      .eq('document_id', 'test-doc')
      .order('created_at', { ascending: false })
      .limit(1);

    expect(data.length).toBe(1);
    expect(data[0].document_id).toBe('test-doc');
    expect(data[0].update).toBeDefined();
  });

  it('rejects connections with invalid tokens', async () => {
    const invalidProvider = new WebsocketProvider(
      'ws://localhost:1234',
      'test-doc',
      new Y.Doc(),
      { params: { token: 'invalid-token' } }
    );

    // Wait for connection failure
    await new Promise((resolve) => {
      invalidProvider.on('connection-error', (error) => {
        expect(error).toBeDefined();
        resolve();
      });

      // Timeout in case the error doesn't occur
      setTimeout(() => {
        invalidProvider.disconnect();
        throw new Error('Connection did not fail as expected');
      }, 1000);
    });
  });
});
```

### Database Service Testing

Test data access services:

- CRUD operations
- Transaction management
- Query optimization
- Error handling and recovery

Example:

```typescript
// Database service test
describe('NodeService', () => {
  let nodeService;

  beforeEach(async () => {
    // Initialize database service with test database
    nodeService = new NodeService(testDb);
    // Set up test data
    await setupTestNodes();
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestNodes();
  });

  it('getNodeById returns a node', async () => {
    const node = await nodeService.getNodeById('test-node-1');

    expect(node).toMatchObject({
      id: 'test-node-1',
      data: { content: 'Test content 1' },
      position: { x: 100, y: 100 },
    });
  });

  it('createNode creates a new node', async () => {
    const newNode = {
      data: { content: 'New node' },
      position: { x: 200, y: 200 },
    };

    const result = await nodeService.createNode(newNode, 'user-1');

    expect(result).toMatchObject({
      id: expect.any(String),
      ...newNode,
      createdBy: 'user-1',
    });

    // Verify it exists in the database
    const savedNode = await nodeService.getNodeById(result.id);
    expect(savedNode).toMatchObject(result);
  });

  it('updateNode updates a node', async () => {
    const updateData = {
      data: { content: 'Updated content' },
    };

    const result = await nodeService.updateNode('test-node-1', updateData);

    expect(result).toMatchObject({
      id: 'test-node-1',
      data: { content: 'Updated content' },
      position: { x: 100, y: 100 },
    });

    // Verify it was updated in the database
    const updatedNode = await nodeService.getNodeById('test-node-1');
    expect(updatedNode.data.content).toBe('Updated content');
  });

  it('deleteNode deletes a node', async () => {
    const result = await nodeService.deleteNode('test-node-1');

    expect(result).toBe(true);

    // Verify it was deleted from the database
    await expect(nodeService.getNodeById('test-node-1')).rejects.toThrow();
  });

  it('handles concurrent updates with optimistic locking', async () => {
    // Simulate two concurrent updates
    const update1 = nodeService.updateNode('test-node-1', {
      data: { content: 'Update 1' },
      version: 1,
    });

    const update2 = nodeService.updateNode('test-node-1', {
      data: { content: 'Update 2' },
      version: 1,
    });

    // One should succeed, one should fail
    await expect(Promise.all([update1, update2])).rejects.toThrow();

    // The node should have one of the updates
    const updatedNode = await nodeService.getNodeById('test-node-1');
    expect(['Update 1', 'Update 2']).toContain(updatedNode.data.content);
    expect(updatedNode.version).toBe(2);
  });
});
```

### Authentication Testing

Test authentication and authorization:

- User login and registration
- Token validation
- Permission checks
- Session management

Example:

```typescript
// Auth middleware test
describe('Auth Middleware', () => {
  it('allows requests with valid tokens', async () => {
    // Mock request with valid token
    const req = {
      headers: {
        authorization: 'Bearer valid-token',
      },
    };

    const res = {};
    const next = jest.fn();

    // Mock token verification
    jest.spyOn(authService, 'verifyToken').mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    });

    await authMiddleware(req, res, next);

    // Middleware should call next()
    expect(next).toHaveBeenCalledTimes(1);

    // User should be attached to request
    expect(req.user).toEqual({
      id: 'user-1',
      email: 'test@example.com',
    });
  });

  it('rejects requests with invalid tokens', async () => {
    // Mock request with invalid token
    const req = {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    // Mock token verification failure
    jest
      .spyOn(authService, 'verifyToken')
      .mockRejectedValue(new Error('Invalid token'));

    await authMiddleware(req, res, next);

    // Middleware should not call next()
    expect(next).not.toHaveBeenCalled();

    // Response should have 401 status
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication failed',
    });
  });

  it('handles missing authorization header', async () => {
    // Mock request with no authorization header
    const req = {
      headers: {},
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authMiddleware(req, res, next);

    // Middleware should not call next()
    expect(next).not.toHaveBeenCalled();

    // Response should have 401 status
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication failed',
    });
  });
});
```

## Testing Database Interactions

### Database Setup for Tests

Use dedicated test database with:

- Isolated test data
- Clean state between tests
- Realistic schema and constraints

```typescript
// Database setup for tests
import { Pool } from 'pg';
import { execSync } from 'child_process';

// Create test database connection
const testDb = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'riff_test',
});

// Set up database before all tests
beforeAll(async () => {
  // Run migrations to set up schema
  execSync('npm run migrate:test');
});

// Clean up database after all tests
afterAll(async () => {
  await testDb.end();
});

// Reset database between tests
beforeEach(async () => {
  await testDb.query('BEGIN');
});

afterEach(async () => {
  await testDb.query('ROLLBACK');
});
```

### Using In-Memory Database

For faster tests that don't require full PostgreSQL:

```typescript
// In-memory database setup
import { newDb } from 'pg-mem';

// Create in-memory database
const db = newDb();

// Initialize schema
db.public.none(`
  CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    position JSONB NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
  );
  
  CREATE TABLE edges (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`);

// Export for use in tests
export const testDb = db.adapters.createPg();
```

## Mocking External Dependencies

### Third-Party Services

For external API dependencies:

```typescript
// Mock OpenAI API
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Mocked AI response',
                },
              },
            ],
          }),
        },
      },
    })),
  };
});
```

### Socket.IO Mocking

For testing socket event handlers:

```typescript
// Mock Socket.IO
jest.mock('socket.io', () => {
  const mockIo = {
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    join: jest.fn(),
    leave: jest.fn(),
  };

  return {
    Server: jest.fn().mockImplementation(() => mockIo),
  };
});
```

### Database Mocking

For isolating services from the database:

```typescript
// Mock Supabase
jest.mock('@supabase/supabase-js', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    data: [],
    error: null,
    mockReset() {
      this.data = [];
      this.error = null;
    },
    mockReturnValue(data, error = null) {
      this.data = data;
      this.error = error;
      return this;
    },
  };

  return {
    createClient: jest.fn().mockReturnValue({
      auth: {
        getUser: jest.fn(),
      },
      storage: {
        from: jest.fn().mockReturnThis(),
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
      },
      ...mockSupabase,
    }),
  };
});
```

## Test Organization

Organize backend tests using the following structure:

```
src/
├── controllers/
│   ├── nodeController.ts
│   └── __tests__/
│       └── nodeController.test.ts
├── services/
│   ├── nodeService.ts
│   └── __tests__/
│       └── nodeService.test.ts
├── middleware/
│   ├── auth.ts
│   └── __tests__/
│       └── auth.test.ts
├── utils/
│   ├── formatResponse.ts
│   └── __tests__/
│       └── formatResponse.test.ts
├── websocket/
│   ├── socketServer.ts
│   └── __tests__/
│       └── socketServer.test.ts
```

## Additional Testing Considerations

### Asynchronous Testing

Properly test async behavior with:

- Proper async/await usage
- Race condition simulation
- Timeout handling

### Error Handling Testing

Ensure robust error handling with tests for:

- Database connection failures
- External service outages
- Invalid input data
- Unexpected states

### Performance Testing

Include tests for:

- Response time benchmarking
- Load handling
- Memory usage
- Connection limits

By following this backend testing strategy, we ensure the reliability and correctness of the Riff server-side implementation, with special focus on the real-time collaboration features.
