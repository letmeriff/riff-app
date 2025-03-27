/**
 * Test fixtures for API testing
 */

// API Response fixtures for mocking
export const userResponses = {
  success: {
    id: 'test-user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.png',
  },
  notFound: {
    error: 'User not found',
    status: 404,
  },
  unauthorized: {
    error: 'Unauthorized',
    status: 401,
  },
  badRequest: {
    error: 'Invalid input',
    status: 400,
  },
};

export const authResponses = {
  login: {
    user: {
      id: 'test-user-1',
      email: 'test@example.com',
      name: 'Test User',
    },
    token: 'test.jwt.token',
  },
  register: {
    user: {
      id: 'new-user-1',
      email: 'new@example.com',
      name: 'New User',
    },
    token: 'new.jwt.token',
  },
  invalidCredentials: {
    error: 'Invalid credentials',
    status: 401,
  },
  emailInUse: {
    error: 'Email already in use',
    status: 409,
  },
};

export const canvasResponses = {
  get: {
    id: 'test-canvas-1',
    name: 'Test Canvas',
    createdBy: 'test-user-1',
    nodes: [
      {
        id: 'test-node-1',
        data: { content: 'Test Node 1' },
        position: { x: 100, y: 100 },
      },
      {
        id: 'test-node-2',
        data: { content: 'Test Node 2' },
        position: { x: 200, y: 200 },
      },
    ],
    edges: [
      {
        id: 'test-edge-1',
        source: 'test-node-1',
        target: 'test-node-2',
      },
    ],
  },
  list: [
    {
      id: 'test-canvas-1',
      name: 'Test Canvas 1',
      createdBy: 'test-user-1',
      createdAt: '2023-01-01T00:00:00Z',
    },
    {
      id: 'test-canvas-2',
      name: 'Test Canvas 2',
      createdBy: 'test-user-1',
      createdAt: '2023-01-02T00:00:00Z',
    },
  ],
  create: {
    id: 'new-canvas-1',
    name: 'New Canvas',
    createdBy: 'test-user-1',
    nodes: [],
    edges: [],
  },
  notFound: {
    error: 'Canvas not found',
    status: 404,
  },
  forbidden: {
    error: 'You do not have permission to access this canvas',
    status: 403,
  },
};

// Request body fixtures
export const authRequests = {
  login: {
    email: 'test@example.com',
    password: 'password123',
  },
  register: {
    email: 'new@example.com',
    password: 'newpassword123',
    name: 'New User',
  },
  invalidLogin: {
    email: 'test@example.com',
    password: 'wrongpassword',
  },
  invalidRegister: {
    email: 'invalid-email',
    password: 'short',
  },
};

export const canvasRequests = {
  create: {
    name: 'New Canvas',
  },
  update: {
    name: 'Updated Canvas Name',
  },
  addNode: {
    data: { content: 'New Node Content' },
    position: { x: 300, y: 300 },
  },
  updateNode: {
    data: { content: 'Updated Node Content' },
  },
  moveNode: {
    position: { x: 400, y: 400 },
  },
  addEdge: {
    source: 'test-node-1',
    target: 'test-node-2',
  },
};
