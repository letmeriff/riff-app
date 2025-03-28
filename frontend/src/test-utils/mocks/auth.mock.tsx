import React from 'react';
import { AuthContextType } from '../../contexts/AuthContext';
import { User, Session } from '@supabase/supabase-js';

// Create a mock User that matches Supabase's User type
export const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  role: '',
  updated_at: new Date().toISOString(),
};

// Create a mock Session that matches Supabase's Session type
export const mockSession: Session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  expires_at: new Date().getTime() + 3600 * 1000,
  token_type: 'bearer',
  user: mockUser,
};

export const mockAuthContextValue: AuthContextType = {
  user: mockUser,
  session: mockSession,
  signUp: jest.fn(() => Promise.resolve()),
  signIn: jest.fn(() => Promise.resolve()),
  signOut: jest.fn(() => Promise.resolve()),
};

// Create AuthContext for mock
export const MockAuthContext = React.createContext<AuthContextType>(mockAuthContextValue);

// Create a mock AuthProvider component
export const MockAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MockAuthContext.Provider value={mockAuthContextValue}>
      {children}
    </MockAuthContext.Provider>
  );
};

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  __esModule: true,
  AuthContext: MockAuthContext,
  AuthProvider: MockAuthProvider,
  useAuth: jest.fn(() => mockAuthContextValue),
})); 