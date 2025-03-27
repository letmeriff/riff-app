import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import api from './api';

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
  let requestInterceptor: Function;
  let requestErrorInterceptor: Function;
  let responseInterceptor: Function;
  let responseErrorInterceptor: Function;
  
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
      
      const config: any = {
        headers: {}
      };
      
      const result = requestInterceptor(config);
      
      expect(result.headers.Authorization).toBe('Bearer test-token');
    });
    
    it('does not modify headers when token is not in localStorage', () => {
      const config: any = {
        headers: {}
      };
      
      const result = requestInterceptor(config);
      
      expect(result.headers.Authorization).toBeUndefined();
    });
    
    it('handles configuration without headers', () => {
      localStorageMock.setItem('authToken', 'test-token');
      
      const config: any = {};
      
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
      // @ts-ignore: Intentionally overriding read-only property for testing
      window.location = { href: '' } as Location;
      
      localStorageMock.setItem('authToken', 'test-token');
      
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      } as AxiosError;
      
      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
      expect(window.location.href).toBe('/login');
      
      // Restore the original location
      // @ts-ignore: Intentionally restoring read-only property
      window.location = originalLocation;
    });
    
    it('rejects with error for non-401 errors', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Server error' }
        }
      } as AxiosError;
      
      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
    
    it('rejects with error when response property is missing', async () => {
      const error = new Error('Network error') as AxiosError;
      
      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
  });
}); 