import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom'; // Added explicit import for clarity
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '../services/supabase';

// Mock Supabase
jest.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

// Test component that consumes the auth context
const TestAuthConsumer = () => {
  const { user, signIn, signUp, signOut } = useAuth();
  
  return (
    <div>
      <div data-testid="user-email">{user?.email || 'No user'}</div>
      <button onClick={() => signIn('test@example.com', 'password')}>Sign In</button>
      <button onClick={() => signUp('new@example.com', 'password')}>Sign Up</button>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock subscription unsubscribe method
    const mockUnsubscribe = jest.fn();
    (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });
  
  test('initializes with no user', async () => {
    // Mock empty session
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });
    
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );
    
    // Should show "No user" initially
    expect(await screen.findByText('No user')).toBeInTheDocument();
    expect(supabase.auth.getSession).toHaveBeenCalled();
  });
  
  test('updates user state when session exists', async () => {
    const mockUser = { id: 'user1', email: 'test@example.com' };
    const mockSession = { user: mockUser };
    
    // Mock session with user
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
    });
    
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );
    
    // Should display the user email
    expect(await screen.findByText('test@example.com')).toBeInTheDocument();
  });
  
  test('updates user when auth state changes', async () => {
    // Initial state - no user
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });
    
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );
    
    expect(await screen.findByText('No user')).toBeInTheDocument();
    
    // Simulate auth state change
    const mockUser = { id: 'user1', email: 'newuser@example.com' };
    const mockSession = { user: mockUser };
    
    // Get the callback function that was passed to onAuthStateChange
    const authStateCallback = (supabase.auth.onAuthStateChange as jest.Mock).mock.calls[0][0];
    // Call it with a session
    authStateCallback('SIGNED_IN', mockSession);
    
    // Should update to show the new user
    expect(await screen.findByText('newuser@example.com')).toBeInTheDocument();
  });
  
  test('signIn calls Supabase signInWithPassword with correct parameters', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });
    
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: { email: 'test@example.com' } },
      error: null,
    });
    
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );
    
    // Click sign in button
    screen.getByText('Sign In').click();
    
    // Check if signInWithPassword was called with correct params
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
  });
  
  test('signUp calls Supabase signUp with correct parameters', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });
    
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { user: { email: 'new@example.com' } },
      error: null,
    });
    
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );
    
    // Click sign up button
    screen.getByText('Sign Up').click();
    
    // Check if signUp was called with correct params
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password',
    });
  });
  
  test('signOut calls Supabase signOut', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });
    
    (supabase.auth.signOut as jest.Mock).mockResolvedValue({
      error: null,
    });
    
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );
    
    // Click sign out button
    screen.getByText('Sign Out').click();
    
    // Check if signOut was called
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
  
  test('throws error when signIn fails', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });
    
    const mockError = { message: 'Invalid credentials' };
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: mockError,
    });
    
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );
    
    // Mock console.error to prevent test output noise
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    // Expect the signIn to throw an error
    await expect(async () => {
      screen.getByText('Sign In').click();
      // Wait for the promise to resolve
      await act(() => Promise.resolve());
    }).rejects.toThrow();
    
    // Restore console.error
    console.error = originalConsoleError;
    
    expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
  });
  
  test('throws error when signUp fails', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });
    
    const mockError = { message: 'Email already in use' };
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: mockError,
    });
    
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );
    
    // Mock console.error to prevent test output noise
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    // Expect the signUp to throw an error
    await expect(async () => {
      screen.getByText('Sign Up').click();
      // Wait for the promise to resolve
      await act(() => Promise.resolve());
    }).rejects.toThrow();
    
    // Restore console.error
    console.error = originalConsoleError;
    
    expect(supabase.auth.signUp).toHaveBeenCalled();
  });
  
  test('throws error when signOut fails', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });
    
    const mockError = { message: 'Network error' };
    (supabase.auth.signOut as jest.Mock).mockResolvedValue({
      error: mockError,
    });
    
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );
    
    // Mock console.error to prevent test output noise
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    // Expect the signOut to throw an error
    await expect(async () => {
      screen.getByText('Sign Out').click();
      // Wait for the promise to resolve
      await act(() => Promise.resolve());
    }).rejects.toThrow();
    
    // Restore console.error
    console.error = originalConsoleError;
    
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
  
  test('useAuth throws error when used outside AuthProvider', () => {
    // Mock console.error to prevent test output noise
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    // Expect error when rendering consumer without provider
    expect(() => {
      render(<TestAuthConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');
    
    // Restore console.error
    console.error = originalConsoleError;
  });
});
