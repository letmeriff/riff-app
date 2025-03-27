import axios from 'axios';
// Import the api but use _api naming to avoid unused variable warning
import _api from './api';

// Mock axios module
jest.mock('axios', () => {
  return {
    create: jest.fn().mockReturnValue({
      interceptors: {
        request: {
          use: jest.fn()
        },
        response: {
          use: jest.fn()
        }
      }
    })
  };
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('API Utility', () => {
  // Use specific typed function signatures instead of generic Function type
  let requestInterceptor: (config: Record<string, unknown>) => Record<string, unknown>;
  let requestErrorInterceptor: (error: Error) => Promise<never>;
  let responseInterceptor: (response: unknown) => unknown;
  let responseErrorInterceptor: (error: Record<string, unknown>) => Promise<never>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Extract interceptor functions
    requestInterceptor = (axios.create as jest.Mock).mock.results[0].value.interceptors.request.use.mock.calls[0][0];
    requestErrorInterceptor = (axios.create as jest.Mock).mock.results[0].value.interceptors.request.use.mock.calls[0][1];
    responseInterceptor = (axios.create as jest.Mock).mock.results[0].value.interceptors.response.use.mock.calls[0][0];
    responseErrorInterceptor = (axios.create as jest.Mock).mock.results[0].value.interceptors.response.use.mock.calls[0][1];
  });
  
  it('creates axios instance with correct configuration', () => {
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:3001/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
  
  it('sets up request and response interceptors', () => {
    expect(axios.create().interceptors.request.use).toHaveBeenCalled();
    expect(axios.create().interceptors.response.use).toHaveBeenCalled();
  });
  
  describe('Request Interceptor', () => {
    it('adds auth token to headers when token exists in localStorage', () => {
      localStorageMock.setItem('authToken', 'test-token');
      
      const config: Record<string, unknown> = {
        headers: {}
      };
      
      const result = requestInterceptor(config);
      
      expect((result.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    });
    
    it('does not modify headers when token is not in localStorage', () => {
      const config: Record<string, unknown> = {
        headers: {}
      };
      
      const result = requestInterceptor(config);
      
      expect((result.headers as Record<string, unknown>).Authorization).toBeUndefined();
    });
    
    it('handles configuration without headers', () => {
      localStorageMock.setItem('authToken', 'test-token');
      
      const config: Record<string, unknown> = {};
      
      const result = requestInterceptor(config);
      
      expect(result).toEqual(config);
    });
    
    it('rejects with error in error handler', async () => {
      const error = new Error('Test error');
      
      await expect(requestErrorInterceptor(error)).rejects.toEqual(error);
    });
  });
  
  describe('Response Interceptor', () => {
    it('returns response directly when successful', () => {
      const response = { data: { success: true } };
      
      expect(responseInterceptor(response)).toBe(response);
    });
    
    it('handles 401 errors by removing token and redirecting', async () => {
      // Mock the window.location.href property
      const originalLocation = window.location;
      
      // Need to override the location object
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: '' },
      });
      
      localStorageMock.setItem('authToken', 'test-token');
      
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };
      
      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
      expect(window.location.href).toBe('/login');
      
      // Restore the original location
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });
    
    it('rejects with error for non-401 errors', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Server error' }
        }
      };
      
      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
    
    it('rejects with error when response property is missing', async () => {
      const error = new Error('Network error');
      
      await expect(responseErrorInterceptor(error as unknown as Record<string, unknown>)).rejects.toEqual(error);
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
  });
}); 