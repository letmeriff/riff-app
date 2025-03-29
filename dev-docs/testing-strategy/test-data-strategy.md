# Test Data Strategy

This document outlines the approach for managing test data in the Riff application test suite.

## Test Data Requirements

The Riff application requires various types of test data:

1. **Canvas Data**: Nodes, edges, and positioning information
2. **Chat Messages**: User and AI message content
3. **User Data**: Authentication and profile information
4. **Collaboration Data**: Awareness information and editing states
5. **Yjs Documents**: Shared document structure for real-time collaboration

## Test Data Approach

### Static Test Data

For deterministic test scenarios, create static fixtures that can be reused across tests:

```typescript
// src/test-utils/fixtures/canvasFixtures.ts
export const sampleCanvas = {
  id: 'canvas-1',
  name: 'Test Canvas',
  createdBy: 'user-1',
  nodes: [
    {
      id: 'node-1',
      data: { content: 'Node 1 Content' },
      position: { x: 100, y: 100 },
    },
    {
      id: 'node-2',
      data: { content: 'Node 2 Content' },
      position: { x: 300, y: 200 },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
    },
  ],
};

export const emptyCanvas = {
  id: 'canvas-2',
  name: 'Empty Canvas',
  createdBy: 'user-1',
  nodes: [],
  edges: [],
};

export const largeCanvas = {
  id: 'canvas-3',
  name: 'Large Canvas',
  createdBy: 'user-1',
  nodes: Array(100)
    .fill(null)
    .map((_, i) => ({
      id: `node-${i + 1}`,
      data: { content: `Node ${i + 1} Content` },
      position: { x: (i % 10) * 200, y: Math.floor(i / 10) * 200 },
    })),
  edges: Array(50)
    .fill(null)
    .map((_, i) => ({
      id: `edge-${i + 1}`,
      source: `node-${i + 1}`,
      target: `node-${((i + 1) % 100) + 1}`,
    })),
};
```

```typescript
// src/test-utils/fixtures/chatFixtures.ts
export const sampleChatHistory = {
  nodeId: 'node-1',
  messages: [
    {
      id: 'msg-1',
      content: 'Hello, can you help me with a project idea?',
      sender: 'user',
      timestamp: '2023-09-10T14:30:00Z',
    },
    {
      id: 'msg-2',
      content:
        "Of course! I'd be happy to help brainstorm project ideas. What area are you interested in?",
      sender: 'ai',
      timestamp: '2023-09-10T14:30:10Z',
    },
    {
      id: 'msg-3',
      content: "I'm thinking about creating a collaborative note-taking app.",
      sender: 'user',
      timestamp: '2023-09-10T14:31:00Z',
    },
  ],
};

export const longChatHistory = {
  nodeId: 'node-2',
  messages: Array(50)
    .fill(null)
    .map((_, i) => ({
      id: `msg-${i + 1}`,
      content:
        i % 2 === 0
          ? `User message ${Math.floor(i / 2) + 1}`
          : `AI response ${Math.floor(i / 2) + 1}`,
      sender: i % 2 === 0 ? 'user' : 'ai',
      timestamp: new Date(Date.now() - (50 - i) * 60000).toISOString(),
    })),
};
```

```typescript
// src/test-utils/fixtures/userFixtures.ts
export const sampleUsers = [
  {
    id: 'user-1',
    email: 'user1@example.com',
    name: 'Test User 1',
    avatarUrl: 'https://example.com/avatar1.png',
  },
  {
    id: 'user-2',
    email: 'user2@example.com',
    name: 'Test User 2',
    avatarUrl: 'https://example.com/avatar2.png',
  },
  {
    id: 'user-3',
    email: 'user3@example.com',
    name: 'Test User 3',
    avatarUrl: 'https://example.com/avatar3.png',
  },
];

export const userWithoutAvatar = {
  id: 'user-4',
  email: 'user4@example.com',
  name: 'Test User 4',
  avatarUrl: null,
};

export const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin User',
  avatarUrl: 'https://example.com/admin.png',
  role: 'admin',
};
```

### Dynamic Test Data Generation

For tests requiring varied or randomized data:

```typescript
// src/test-utils/generators/canvasGenerator.ts
export const generateCanvas = (options = {}) => {
  const {
    id = `canvas-${Math.random().toString(36).substring(2, 9)}`,
    name = `Canvas ${Math.floor(Math.random() * 1000)}`,
    createdBy = 'user-1',
    nodeCount = 5,
    edgeCount = 3,
  } = options;

  // Generate nodes
  const nodes = Array(nodeCount)
    .fill(null)
    .map((_, i) => ({
      id: `node-${i + 1}`,
      data: { content: `Generated Node ${i + 1}` },
      position: {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
    }));

  // Generate edges (if nodes exist)
  const edges =
    nodeCount > 1
      ? Array(Math.min(edgeCount, nodeCount - 1))
          .fill(null)
          .map((_, i) => ({
            id: `edge-${i + 1}`,
            source: `node-${i + 1}`,
            target: `node-${((i + 1) % nodeCount) + 1}`,
          }))
      : [];

  return {
    id,
    name,
    createdBy,
    nodes,
    edges,
  };
};
```

```typescript
// src/test-utils/generators/messageGenerator.ts
export const generateChatMessages = (options = {}) => {
  const {
    nodeId = 'node-1',
    messageCount = 10,
    startTime = Date.now() - messageCount * 60000,
  } = options;

  return {
    nodeId,
    messages: Array(messageCount)
      .fill(null)
      .map((_, i) => ({
        id: `msg-${i + 1}`,
        content: i % 2 === 0 ? generateUserMessage(i) : generateAIResponse(i),
        sender: i % 2 === 0 ? 'user' : 'ai',
        timestamp: new Date(startTime + i * 60000).toISOString(),
      })),
  };
};

const generateUserMessage = (index) => {
  const questions = [
    'Can you help me with this idea?',
    'What do you think about this approach?',
    'How would you improve this concept?',
    'Do you have any suggestions?',
    'What are the alternatives to this solution?',
  ];

  return questions[index % questions.length];
};

const generateAIResponse = (index) => {
  const responses = [
    "That's an interesting question. Let me think about it...",
    'There are several ways to approach this problem. First...',
    'I think your idea has merit, but have you considered...',
    'Based on my analysis, I would recommend...',
    'This concept could be extended by incorporating...',
  ];

  return responses[index % responses.length];
};
```

### Factory Pattern for Complex Objects

For complex test objects with hierarchical structure:

```typescript
// src/test-utils/factories/canvasFactory.ts
export class CanvasFactory {
  private canvas = {
    id: `canvas-${Math.random().toString(36).substring(2, 9)}`,
    name: 'Test Canvas',
    createdBy: 'user-1',
    nodes: [],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  withId(id: string): CanvasFactory {
    this.canvas.id = id;
    return this;
  }

  withName(name: string): CanvasFactory {
    this.canvas.name = name;
    return this;
  }

  withCreator(userId: string): CanvasFactory {
    this.canvas.createdBy = userId;
    return this;
  }

  withNode(node: any): CanvasFactory {
    this.canvas.nodes.push(node);
    return this;
  }

  withNodes(count: number): CanvasFactory {
    for (let i = 0; i < count; i++) {
      this.canvas.nodes.push({
        id: `node-${i + 1}`,
        data: { content: `Node ${i + 1} Content` },
        position: { x: i * 200, y: i * 100 },
      });
    }
    return this;
  }

  withEdge(edge: any): CanvasFactory {
    this.canvas.edges.push(edge);
    return this;
  }

  withConnection(sourceId: string, targetId: string): CanvasFactory {
    this.canvas.edges.push({
      id: `edge-${this.canvas.edges.length + 1}`,
      source: sourceId,
      target: targetId,
    });
    return this;
  }

  build() {
    return { ...this.canvas };
  }

  static create(): CanvasFactory {
    return new CanvasFactory();
  }
}
```

Example usage:

```typescript
const testCanvas = CanvasFactory.create()
  .withName('Collaborative Canvas')
  .withCreator('user-2')
  .withNodes(3)
  .withConnection('node-1', 'node-2')
  .withConnection('node-2', 'node-3')
  .build();
```

## Test Database Strategy

### In-Memory Database for Unit Tests

For fast unit tests, use in-memory database with known state:

```typescript
// src/test-utils/db/inMemoryDb.ts
import { newDb } from 'pg-mem';

export const createTestDatabase = () => {
  const db = newDb();

  // Create schema
  db.public.none(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT
    );
    
    CREATE TABLE canvases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL REFERENCES canvases(id),
      data JSONB NOT NULL,
      position JSONB NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE edges (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL REFERENCES canvases(id),
      source TEXT NOT NULL REFERENCES nodes(id),
      target TEXT NOT NULL REFERENCES nodes(id),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db.adapters.createPg();
};

export const seedTestDatabase = async (db) => {
  // Insert test users
  await db.query(`
    INSERT INTO users (id, email, name, avatar_url)
    VALUES 
      ('user-1', 'user1@example.com', 'Test User 1', 'https://example.com/avatar1.png'),
      ('user-2', 'user2@example.com', 'Test User 2', 'https://example.com/avatar2.png')
  `);

  // Insert test canvas
  await db.query(`
    INSERT INTO canvases (id, name, created_by)
    VALUES ('canvas-1', 'Test Canvas', 'user-1')
  `);

  // Insert test nodes
  await db.query(`
    INSERT INTO nodes (id, canvas_id, data, position, created_by)
    VALUES 
      ('node-1', 'canvas-1', '{"content": "Node 1 Content"}', '{"x": 100, "y": 100}', 'user-1'),
      ('node-2', 'canvas-1', '{"content": "Node 2 Content"}', '{"x": 300, "y": 200}', 'user-1')
  `);

  // Insert test edge
  await db.query(`
    INSERT INTO edges (id, canvas_id, source, target, created_by)
    VALUES ('edge-1', 'canvas-1', 'node-1', 'node-2', 'user-1')
  `);
};
```

### Test Transaction Management

For database tests with isolation:

```typescript
// src/test-utils/db/transactionManager.ts
import { Pool } from 'pg';

export class TestTransactionManager {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('ROLLBACK');
      return result;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}
```

Example usage:

```typescript
// NodeService.test.ts
describe('NodeService', () => {
  const txManager = new TestTransactionManager(process.env.TEST_DATABASE_URL);

  afterAll(async () => {
    await txManager.close();
  });

  it('should create a node', async () => {
    await txManager.withTransaction(async (client) => {
      const nodeService = new NodeService(client);

      const newNode = await nodeService.createNode({
        canvasId: 'canvas-1',
        data: { content: 'Test Content' },
        position: { x: 100, y: 100 },
        createdBy: 'user-1',
      });

      expect(newNode).toMatchObject({
        id: expect.any(String),
        data: { content: 'Test Content' },
        position: { x: 100, y: 100 },
      });

      // Verify it was saved to the database
      const result = await client.query('SELECT * FROM nodes WHERE id = $1', [
        newNode.id,
      ]);

      expect(result.rows.length).toBe(1);
    });
  });
});
```

## Yjs Test Data

### Yjs Document Generator

For testing with Yjs documents:

```typescript
// src/test-utils/yjs/documentGenerator.ts
import * as Y from 'yjs';

export const createYjsDocument = (options = {}) => {
  const { nodeCount = 5, edgeCount = 3, userId = 'user-1' } = options;

  // Create new document
  const doc = new Y.Doc();

  // Generate nodes and add to document
  const nodesMap = doc.getMap('nodes');

  for (let i = 0; i < nodeCount; i++) {
    const nodeId = `node-${i + 1}`;
    nodesMap.set(nodeId, {
      id: nodeId,
      data: { content: `Yjs Node ${i + 1}` },
      position: { x: i * 200, y: i * 100 },
      createdBy: userId,
    });
  }

  // Generate edges and add to document
  const edgesMap = doc.getMap('edges');

  for (let i = 0; i < Math.min(edgeCount, nodeCount - 1); i++) {
    const edgeId = `edge-${i + 1}`;
    edgesMap.set(edgeId, {
      id: edgeId,
      source: `node-${i + 1}`,
      target: `node-${((i + 1) % nodeCount) + 1}`,
      createdBy: userId,
    });
  }

  return doc;
};

export const createEmptyYjsDocument = () => {
  return new Y.Doc();
};

export const encodeYjsState = (doc: Y.Doc): Uint8Array => {
  return Y.encodeStateAsUpdate(doc);
};
```

### Mock Yjs Updates

For testing update handling:

```typescript
// src/test-utils/yjs/updateGenerator.ts
import * as Y from 'yjs';

export const generateNodePositionUpdate = (
  doc: Y.Doc,
  nodeId: string,
  position: { x: number; y: number }
): Uint8Array => {
  // Create a transaction to modify the document
  doc.transact(() => {
    const nodesMap = doc.getMap('nodes');
    const node = nodesMap.get(nodeId);

    if (node) {
      // Update node position
      node.position = position;
      nodesMap.set(nodeId, { ...node });
    }
  });

  // Get update since version 0
  return Y.encodeStateAsUpdate(doc);
};

export const generateNodeAddUpdate = (doc: Y.Doc, node: any): Uint8Array => {
  // Create a transaction to modify the document
  doc.transact(() => {
    const nodesMap = doc.getMap('nodes');
    nodesMap.set(node.id, node);
  });

  // Get update since version 0
  return Y.encodeStateAsUpdate(doc);
};

export const generateNodeDeleteUpdate = (
  doc: Y.Doc,
  nodeId: string
): Uint8Array => {
  // Create a transaction to modify the document
  doc.transact(() => {
    const nodesMap = doc.getMap('nodes');
    nodesMap.delete(nodeId);
  });

  // Get update since version 0
  return Y.encodeStateAsUpdate(doc);
};
```

## Test Data Management Principles

1. **Isolation**: Test data should not affect other tests
2. **Determinism**: Tests should produce the same result with the same data
3. **Clarity**: Test data should be easy to understand and relevant to the test
4. **Maintainability**: Test data should be organized and easy to update
5. **Performance**: Test data creation should be efficient

By following these principles and strategies, we can ensure effective and reliable testing of the Riff application with appropriate test data.
