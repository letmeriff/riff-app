/**
 * Common Test Utilities
 *
 * This module provides shared utilities for testing
 */

import { User } from '@supabase/supabase-js';

/**
 * Creates a mock successful Supabase response
 * @param data The data to include in the response
 * @returns A mock Supabase response object with the provided data
 */
export const mockSupabaseResponse = <T>(data: T) => ({
  data,
  error: null,
});

/**
 * Creates a mock error Supabase response
 * @param message The error message
 * @param code The error code
 * @returns A mock Supabase error response object
 */
export const mockSupabaseError = (message: string, code = 'ERROR') => ({
  data: null,
  error: { message, code },
});

/**
 * Creates a mock authenticated user
 * @param overrides Optional overrides for the user object
 * @returns A mock user object
 */
export const mockAuthUser = (overrides = {}): User => ({
  id: 'user-1',
  email: 'user1@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  role: 'authenticated',
  ...overrides,
});

/**
 * Sets up a mock WebSocket for testing
 * @returns A mock socket object with jest functions
 */
export const setupTestSocket = () => ({
  id: 'mock-socket-id',
  handshake: {
    auth: {
      token: 'valid-token',
    },
  },
  data: {},
  join: jest.fn(),
  leave: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  viewedNodes: [],
});

/**
 * Sets up a mock socket.io instance for testing
 * @returns A mock io object with jest functions
 */
export const setupTestIo = () => ({
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  on: jest.fn(),
  use: jest.fn(),
});
