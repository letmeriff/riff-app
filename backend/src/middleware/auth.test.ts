import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './auth';
import { supabase } from '../config/supabase';

// Mock Supabase client with proper typing
jest.mock('../config/supabase', () => {
  const mockGetUser = jest.fn();
  return {
    supabase: {
      auth: {
        getUser: mockGetUser,
      },
    },
  };
});

interface RequestHeaders {
  authorization?: string;
  [key: string]: string | undefined;
}

const mockRequest = (headers: RequestHeaders = {}): Partial<Request> => ({
  headers,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext: NextFunction = jest.fn();

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if no token is provided', async () => {
    const req = mockRequest() as Request;
    const res = mockResponse() as Response;

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 401 if token is invalid', async () => {
    const req = mockRequest({
      authorization: 'Bearer invalid-token',
    }) as Request;
    const res = mockResponse() as Response;

    // Mock Supabase auth.getUser to return error for invalid token
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('calls next if token is valid', async () => {
    const mockUser = { id: 'user-id', email: 'test@example.com' };
    const req = mockRequest({ authorization: 'Bearer valid-token' }) as Request;
    const res = mockResponse() as Response;

    // Mock Supabase auth.getUser to return user for valid token
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });

    await authMiddleware(req, res, mockNext);

    expect(req.user).toEqual(mockUser);
    expect(mockNext).toHaveBeenCalled();
  });

  it('handles errors gracefully', async () => {
    const req = mockRequest({ authorization: 'Bearer token' }) as Request;
    const res = mockResponse() as Response;

    // Mock Supabase auth.getUser to throw an error
    (supabase.auth.getUser as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    await authMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
