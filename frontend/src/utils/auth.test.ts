import { supabase } from '../services/supabase';
import { getAuthToken, setAuthToken, clearAuthToken, refreshAuthToken } from './auth';

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  
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
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Supabase
jest.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: jest.fn(),
      getSession: jest.fn(),
    },
  },
}));

describe('Auth utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe('getAuthToken', () => {
    it('returns the token from localStorage', () => {
      localStorageMock.setItem('authToken', 'test-token');
      expect(getAuthToken()).toBe('test-token');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('authToken');
    });

    it('returns null when token is not in localStorage', () => {
      expect(getAuthToken()).toBeNull();
      expect(localStorageMock.getItem).toHaveBeenCalledWith('authToken');
    });
  });

  describe('setAuthToken', () => {
    it('sets the token in localStorage', () => {
      setAuthToken('new-test-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'new-test-token');
      expect(localStorageMock.getItem('authToken')).toBe('new-test-token');
    });

    it('overwrites existing token', () => {
      localStorageMock.setItem('authToken', 'old-token');
      setAuthToken('new-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'new-token');
      expect(localStorageMock.getItem('authToken')).toBe('new-token');
    });
  });

  describe('clearAuthToken', () => {
    it('removes the token from localStorage', () => {
      localStorageMock.setItem('authToken', 'test-token');
      clearAuthToken();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
      expect(localStorageMock.getItem('authToken')).toBeNull();
    });

    it('does nothing if token is not in localStorage', () => {
      clearAuthToken();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });
  });

  describe('refreshAuthToken', () => {
    it('refreshes the token and updates localStorage', async () => {
      const mockSession = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: Date.now() + 3600,
      };

      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      await refreshAuthToken('old-refresh-token');

      expect(supabase.auth.refreshSession).toHaveBeenCalledWith({ 
        refresh_token: 'old-refresh-token' 
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'new-access-token');
    });

    it('clears token if refresh fails', async () => {
      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' },
      });

      await refreshAuthToken('expired-token');

      expect(supabase.auth.refreshSession).toHaveBeenCalledWith({ 
        refresh_token: 'expired-token'
      });
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });

    it('handles network errors gracefully', async () => {
      (supabase.auth.refreshSession as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      // Should not throw
      await refreshAuthToken('some-token');

      expect(supabase.auth.refreshSession).toHaveBeenCalledWith({ 
        refresh_token: 'some-token'
      });
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });

    it('uses current refresh token when not provided', async () => {
      const mockSession = {
        access_token: 'current-access-token',
        refresh_token: 'current-refresh-token',
        expires_at: Date.now() + 3600,
      };
      
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const newMockSession = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: Date.now() + 3600,
      };

      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: newMockSession },
        error: null,
      });

      await refreshAuthToken();

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(supabase.auth.refreshSession).toHaveBeenCalledWith({ 
        refresh_token: 'current-refresh-token'
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'new-access-token');
    });

    it('does nothing if no current session exists', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await refreshAuthToken();

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
    });
  });
}); 