import { Request, Response } from 'express';
import { authMiddleware } from './auth';
import { supabase } from '../config/supabase';

// Mock Supabase client
jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn()
    }
  }
}));

// Helper to create mock request
const mockRequest = (options: Record<string, any> = {}) => {
  return {
    headers: {
      authorization: undefined,
      ...options.headers
    },
    ...options
  };
};

// Helper to create mock response
const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Helper to create mock next function
const mockNext = jest.fn();

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should deny requests with missing authorization header', async () => {
    const req = mockRequest() as Request;
    const res = mockResponse() as Response;

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should deny requests with invalid tokens', async () => {
    const req = mockRequest({
      headers: {
        authorization: 'Bearer invalid-token',
      }
    }) as Request;
    const res = mockResponse() as Response;

    // Mock Supabase auth.getUser to return error for invalid token
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: new Error('Invalid token')
    });

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow requests with valid tokens', async () => {
    const req = mockRequest({ headers: { authorization: 'Bearer valid-token' } }) as Request;
    const res = mockResponse() as Response;

    // Mock Supabase auth.getUser to return user for valid token
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null
    });

    await authMiddleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-123', email: 'test@example.com' });
  });

  it('should handle Supabase errors', async () => {
    const req = mockRequest({ headers: { authorization: 'Bearer token' } }) as Request;
    const res = mockResponse() as Response;

    // Mock Supabase auth.getUser to throw an error
    (supabase.auth.getUser as jest.Mock).mockRejectedValueOnce(
      new Error('Supabase service unavailable')
    );

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('properly extracts token from Authorization header with Bearer prefix', async () => {
    const req = mockRequest({
      headers: {
        authorization: 'Bearer test-token-123'
      }
    }) as Request;
    const res = mockResponse() as Response;

    // Mock Supabase auth.getUser to return user
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null
    });

    await authMiddleware(req, res, mockNext);
    
    expect(supabase.auth.getUser).toHaveBeenCalledWith('test-token-123');
    expect(mockNext).toHaveBeenCalled();
  });

  it('ignores malformed Authorization headers', async () => {
    const req = mockRequest({
      headers: {
        authorization: 'InvalidFormat'
      }
    }) as Request;
    const res = mockResponse() as Response;

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should deny requests when user is null', async () => {
    const req = mockRequest({
      headers: {
        authorization: 'Bearer expired-token',
      }
    }) as Request;
    const res = mockResponse() as Response;

    // Mock Supabase auth.getUser to return null user without error
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: null
    });

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should attach full user object to request', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: { name: 'Test User' },
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    };

    const req = mockRequest({ headers: { authorization: 'Bearer valid-token' } }) as Request;
    const res = mockResponse() as Response;

    // Mock Supabase auth.getUser to return user with complete data
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: mockUser },
      error: null
    });

    await authMiddleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.user).toEqual(mockUser);
  });

  it('should handle Express req with pre-existing properties', async () => {
    // Create request object with existing properties
    const req = {
      headers: { authorization: 'Bearer valid-token' },
      params: { id: '123' },
      query: { filter: 'active' }
    } as unknown as Request;
    
    const res = mockResponse() as Response;

    // Mock Supabase auth.getUser to return user
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null
    });

    await authMiddleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-123' });
    expect(req.params).toEqual({ id: '123' });
    expect(req.query).toEqual({ filter: 'active' });
  });
});
