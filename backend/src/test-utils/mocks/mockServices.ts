/**
 * Mock services for testing backend functionality
 */

// Mock Database Service
export const createMockDbService = () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  transaction: jest.fn().mockImplementation(async (callback) => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    return callback(client);
  }),
  end: jest.fn().mockResolvedValue(undefined),
});

// Mock User Service
export const createMockUserService = () => ({
  getUserById: jest.fn().mockResolvedValue({
    id: 'mock-user-1',
    email: 'mock@example.com',
    name: 'Mock User',
    avatarUrl: 'https://example.com/avatar.png',
  }),
  getUserByEmail: jest.fn().mockResolvedValue({
    id: 'mock-user-1',
    email: 'mock@example.com',
    name: 'Mock User',
    avatarUrl: 'https://example.com/avatar.png',
  }),
  createUser: jest.fn().mockResolvedValue({
    id: 'new-user-1',
    email: 'new@example.com',
    name: 'New User',
    avatarUrl: null,
  }),
  updateUser: jest.fn().mockResolvedValue({
    id: 'mock-user-1',
    email: 'mock@example.com',
    name: 'Updated User',
    avatarUrl: 'https://example.com/updated-avatar.png',
  }),
});

// Mock Canvas Service
export const createMockCanvasService = () => ({
  getCanvasById: jest.fn().mockResolvedValue({
    id: 'mock-canvas-1',
    name: 'Mock Canvas',
    createdBy: 'mock-user-1',
    nodes: [
      {
        id: 'mock-node-1',
        data: { content: 'Mock Node 1' },
        position: { x: 100, y: 100 },
      },
    ],
    edges: [],
  }),
  getCanvasesByUserId: jest.fn().mockResolvedValue([
    {
      id: 'mock-canvas-1',
      name: 'Mock Canvas 1',
      createdBy: 'mock-user-1',
    },
    {
      id: 'mock-canvas-2',
      name: 'Mock Canvas 2',
      createdBy: 'mock-user-1',
    },
  ]),
  createCanvas: jest.fn().mockResolvedValue({
    id: 'new-canvas-1',
    name: 'New Canvas',
    createdBy: 'mock-user-1',
    nodes: [],
    edges: [],
  }),
  updateCanvas: jest.fn().mockResolvedValue({
    id: 'mock-canvas-1',
    name: 'Updated Canvas',
    createdBy: 'mock-user-1',
  }),
  deleteCanvas: jest.fn().mockResolvedValue({ success: true }),
});

// Mock WebSocket Service
export const createMockWebSocketService = () => ({
  broadcast: jest.fn(),
  sendToUser: jest.fn(),
  sendToRoom: jest.fn(),
  addToRoom: jest.fn(),
  removeFromRoom: jest.fn(),
});

// Mock Auth Service
export const createMockAuthService = () => ({
  verifyToken: jest.fn().mockResolvedValue({
    id: 'mock-user-1',
    email: 'mock@example.com',
  }),
  generateToken: jest.fn().mockReturnValue('mock-token-xyz'),
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  comparePassword: jest.fn().mockResolvedValue(true),
});
