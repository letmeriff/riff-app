/**
 * Authentication Provider Mock
 * 
 * This module provides a mock implementation of an authentication provider
 * for testing authentication flows without requiring real authentication services.
 */

import { v4 as uuidv4 } from 'uuid';

// Response types
export interface MockAuthProviderResponseError {
  code: string;
  message: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MockAuthProviderResponse<T = any> {
  success: boolean;
  data?: T;
  error?: MockAuthProviderResponseError;
}

// User profile type
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

// Auth token response
export interface AuthTokenResponse {
  token: string;
  refreshToken: string;
  expiresAt: number;
  user: UserProfile;
}

// Request types
export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

// Provider options
export interface MockAuthProviderOptions {
  users?: UserProfile[];
  delayMs?: number;
  failRate?: number;
}

// Internal state
interface InternalState {
  users: UserProfile[];
  currentUser: UserProfile | null;
  userTokens: Record<string, string>;
}

/**
 * Creates a mock authentication provider for testing
 */
export function createMockAuthProvider(options: MockAuthProviderOptions = {}) {
  // Default options
  const defaultOptions: MockAuthProviderOptions = {
    users: [],
    delayMs: 100,
    failRate: 0
  };
  
  // Merge with provided options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Internal state
  const state: InternalState = {
    users: [...(mergedOptions.users || [])],
    currentUser: null,
    userTokens: {}
  };
  
  /**
   * Simulates network delay and potential failures
   */
  const simulateNetwork = async <T>(value: T): Promise<T> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < (mergedOptions.failRate || 0)) {
          reject(new Error('Network error: Could not connect to authentication service'));
        } else {
          resolve(value);
        }
      }, mergedOptions.delayMs || 0);
    });
  };
  
  /**
   * Creates a success response
   */
  const createSuccessResponse = <T>(data: T): MockAuthProviderResponse<T> => {
    return {
      success: true,
      data
    };
  };
  
  /**
   * Creates an error response
   */
  const createErrorResponse = (code: string, message: string): MockAuthProviderResponse => {
    return {
      success: false,
      error: {
        code,
        message
      }
    };
  };
  
  /**
   * Generates a mock JWT token
   */
  const generateToken = (userId: string): string => {
    const randomToken = uuidv4();
    state.userTokens[userId] = randomToken;
    return randomToken;
  };
  
  /**
   * Finds a user by email
   */
  const findUserByEmail = (email: string): UserProfile | undefined => {
    return state.users.find(user => user.email.toLowerCase() === email.toLowerCase());
  };
  
  // Create the authentication provider interface
  return {
    options: mergedOptions,
    
    /**
     * Sign in with email and password
     */
    async signIn(request: SignInRequest): Promise<MockAuthProviderResponse<AuthTokenResponse>> {
      try {
        await simulateNetwork(null);
        
        const user = findUserByEmail(request.email);
        
        if (!user) {
          return createErrorResponse('auth/invalid-credentials', 'Invalid credentials');
        }
        
        // Set as current user
        state.currentUser = user;
        
        // Generate tokens
        const token = generateToken(user.id);
        const refreshToken = uuidv4();
        const expiresAt = Date.now() + 3600 * 1000; // 1 hour from now
        
        return createSuccessResponse({
          token,
          refreshToken,
          expiresAt,
          user
        });
      } catch (error) {
        return createErrorResponse(
          'auth/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * Sign up with email and password
     */
    async signUp(request: SignUpRequest): Promise<MockAuthProviderResponse<AuthTokenResponse>> {
      try {
        await simulateNetwork(null);
        
        // Check if email already exists
        const existingUser = findUserByEmail(request.email);
        if (existingUser) {
          return createErrorResponse('auth/email-already-in-use', 'Email already in use');
        }
        
        // Create new user
        const newUser: UserProfile = {
          id: uuidv4(),
          email: request.email,
          name: request.name,
          avatarUrl: request.avatarUrl,
          metadata: request.metadata
        };
        
        // Add to users list
        state.users.push(newUser);
        
        // Set as current user
        state.currentUser = newUser;
        
        // Generate tokens
        const token = generateToken(newUser.id);
        const refreshToken = uuidv4();
        const expiresAt = Date.now() + 3600 * 1000; // 1 hour from now
        
        return createSuccessResponse({
          token,
          refreshToken,
          expiresAt,
          user: newUser
        });
      } catch (error) {
        return createErrorResponse(
          'auth/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * Sign out the current user
     */
    async signOut(): Promise<MockAuthProviderResponse<{ message: string }>> {
      try {
        await simulateNetwork(null);
        
        // Clear current user
        state.currentUser = null;
        
        return createSuccessResponse({
          message: 'Successfully signed out'
        });
      } catch (error) {
        return createErrorResponse(
          'auth/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * Get the current authenticated user
     */
    async getCurrentUser(): Promise<MockAuthProviderResponse<UserProfile>> {
      try {
        await simulateNetwork(null);
        
        if (!state.currentUser) {
          return createErrorResponse('auth/not-authenticated', 'Not authenticated');
        }
        
        return createSuccessResponse(state.currentUser);
      } catch (error) {
        return createErrorResponse(
          'auth/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * Refresh the authentication token
     */
    async refreshToken(): Promise<MockAuthProviderResponse<{ token: string; expiresAt: number }>> {
      try {
        await simulateNetwork(null);
        
        if (!state.currentUser) {
          return createErrorResponse('auth/not-authenticated', 'Not authenticated');
        }
        
        // Generate new token
        const token = generateToken(state.currentUser.id);
        const expiresAt = Date.now() + 3600 * 1000; // 1 hour from now
        
        return createSuccessResponse({
          token,
          expiresAt
        });
      } catch (error) {
        return createErrorResponse(
          'auth/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    },
    
    /**
     * Initiate password reset
     */
    async resetPassword(_email: string): Promise<MockAuthProviderResponse<{ message: string }>> {
      try {
        await simulateNetwork(null);
        
        // We return success regardless of whether the email exists
        // This is a security best practice to prevent user enumeration
        return createSuccessResponse({
          message: 'If your email address is associated with an account, a password reset link has been sent to your email'
        });
      } catch (error) {
        return createErrorResponse(
          'auth/network-error',
          error instanceof Error ? error.message : 'Network error'
        );
      }
    }
  };
} 