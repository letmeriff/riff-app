/**
 * WebSocket Service
 *
 * This module provides utilities for WebSocket service implementation
 * with a focus on centralized error handling and modularity.
 */

// Import modularized services
import { authMiddleware as authMiddlewareImpl } from './authMiddleware';
import { joinNode, leaveNode, handleDisconnect } from './roomManagement';
import { handleTyping } from './typingService';
import { handleNodePosition } from './nodePositionService';
import { YjsService } from './yjsService';
import { GlobalIo } from './socketIoService';

// Define socket data type
export interface SocketData {
  user?: {
    id: string;
    email?: string;
    [key: string]: unknown;
  };
}

// Define socket parameter type for event handlers
export interface SocketEventHandler<T = Record<string, unknown>> {
  (data: T): Promise<void>;
}

// Define socket with IO reference for broadcasting
export interface SocketWithIO {
  id: string;
  data: SocketData;
  join: (room: string) => void;
  leave: (room: string) => void;
  on: <T extends unknown[]>(
    event: string,
    callback: (...args: T) => void
  ) => void;
  emit: (event: string, data: unknown) => void;
  to: (room: string) => { emit: (event: string, data: unknown) => void };
}

// Define extended socket type with viewedNodes
export interface SocketWithViewedNodes extends SocketWithIO {
  viewedNodes: number[];
}

// Private store for service instances
let yjsService: YjsService | null = null;

/**
 * Utility function to create an error handler wrapper with proper type safety
 *
 * @param eventName The name of the event for logging purposes
 * @param handler The original handler function to wrap
 * @returns A function that wraps the handler in a try/catch block
 */
export const withErrorHandling = <T>(
  eventName: string,
  handler: (data: T) => Promise<void>
): ((data: T) => Promise<void>) => {
  return async (data: T): Promise<void> => {
    try {
      await handler(data);
    } catch (error) {
      console.error(`Error handling ${eventName} event:`, error);
    }
  };
};

/**
 * Authentication middleware for Socket.IO - public re-export
 */
export const authMiddleware = authMiddlewareImpl;

/**
 * Initialize the WebSocket service with the Socket.IO instance
 *
 * @param io Socket.IO server instance
 */
export const initializeWebSocketService = (
  io: GlobalIo
): { yjsService: YjsService } => {
  // Initialize YjsService
  yjsService = new YjsService(io);

  // Set up authentication middleware
  io.use(authMiddleware);

  // Handle new connections
  io.on('connection', handleConnection);

  console.log('WebSocket service initialized');

  // Return YjsService for use elsewhere if needed
  return { yjsService };
};

/**
 * Type-safe wrapper for socket event handlers
 *
 * @param socket The socket instance
 * @param event The event name
 * @param handler The handler function
 */
const registerEventHandler = <T>(
  socket: SocketWithViewedNodes,
  event: string,
  handler: (socket: SocketWithViewedNodes, data: T) => Promise<void>
): void => {
  socket.on(event, (data: T) => {
    withErrorHandling(event, async (handlerData: T) => {
      await handler(socket, handlerData);
    })(data);
  });
};

/**
 * Handle new socket connection
 *
 * @param socket Socket instance
 */
export const handleConnection = (socket: SocketWithViewedNodes): void => {
  console.log(`User connected: ${socket.data.user?.id}`);

  // Join a room based on the user ID
  const userRoom = `user:${socket.data.user?.id}`;
  socket.join(userRoom);

  // Store viewedNodes in socket object
  socket.viewedNodes = [];

  // Register event handlers with type-safe wrapper
  registerEventHandler<{ nodeId: number }>(socket, 'join-node', joinNode);

  registerEventHandler<{ nodeId: number }>(socket, 'leave-node', leaveNode);

  registerEventHandler<{ nodeId: number; isTyping: boolean }>(
    socket,
    'typing',
    handleTyping
  );

  registerEventHandler<{ nodeId: number; position: { x: number; y: number } }>(
    socket,
    'node-position-update',
    handleNodePosition
  );

  // Handle disconnect
  socket.on('disconnect', () => handleDisconnect(socket));
};
