import {
  createMockAuthProvider,
  MockAuthProviderOptions
} from './authProviderMock';

describe('Authentication Provider Mocks', () => {
  describe('createMockAuthProvider', () => {
    test('should create a mock auth provider with default options', () => {
      const authProvider = createMockAuthProvider();
      
      expect(authProvider).toBeDefined();
      expect(authProvider.signIn).toBeDefined();
      expect(authProvider.signUp).toBeDefined();
      expect(authProvider.signOut).toBeDefined();
      expect(authProvider.getCurrentUser).toBeDefined();
      expect(authProvider.refreshToken).toBeDefined();
      expect(authProvider.resetPassword).toBeDefined();
    });
    
    test('should create a mock auth provider with custom options', () => {
      const options: MockAuthProviderOptions = {
        delayMs: 200,
        failRate: 0.5,
        users: [
          { id: 'user1', email: 'test@example.com', name: 'Test User' }
        ]
      };
      
      const authProvider = createMockAuthProvider(options);
      
      expect(authProvider.options).toEqual(options);
    });
  });
  
  describe('signIn functionality', () => {
    test('should sign in a user with valid credentials', async () => {
      const authProvider = createMockAuthProvider({
        users: [
          { id: 'user1', email: 'valid@example.com', name: 'Valid User' }
        ],
        delayMs: 0
      });
      
      const response = await authProvider.signIn({
        email: 'valid@example.com',
        password: 'password'
      });
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.user.email).toBe('valid@example.com');
      expect(response.data?.token).toBeDefined();
    });
    
    test('should reject sign in with invalid credentials', async () => {
      const authProvider = createMockAuthProvider({
        users: [
          { id: 'user1', email: 'valid@example.com', name: 'Valid User' }
        ],
        delayMs: 0
      });
      
      const response = await authProvider.signIn({
        email: 'invalid@example.com',
        password: 'password'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Invalid credentials');
    });
    
    test('should handle sign in with network failure', async () => {
      const authProvider = createMockAuthProvider({
        failRate: 1, // Always fail
        delayMs: 0
      });
      
      const response = await authProvider.signIn({
        email: 'valid@example.com',
        password: 'password'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Network error');
    });
  });
  
  describe('signUp functionality', () => {
    test('should create a new user account', async () => {
      const authProvider = createMockAuthProvider({
        delayMs: 0
      });
      
      const response = await authProvider.signUp({
        email: 'new@example.com',
        password: 'password',
        name: 'New User'
      });
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.user.email).toBe('new@example.com');
      expect(response.data?.user.name).toBe('New User');
      expect(response.data?.token).toBeDefined();
    });
    
    test('should reject sign up with existing email', async () => {
      const authProvider = createMockAuthProvider({
        users: [
          { id: 'user1', email: 'existing@example.com', name: 'Existing User' }
        ],
        delayMs: 0
      });
      
      const response = await authProvider.signUp({
        email: 'existing@example.com',
        password: 'password',
        name: 'New User'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Email already in use');
    });
  });
  
  describe('getCurrentUser functionality', () => {
    test('should return the current user when authenticated', async () => {
      const authProvider = createMockAuthProvider({
        users: [
          { id: 'user1', email: 'test@example.com', name: 'Test User' }
        ],
        delayMs: 0
      });
      
      // Sign in first
      await authProvider.signIn({
        email: 'test@example.com',
        password: 'password'
      });
      
      const response = await authProvider.getCurrentUser();
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.id).toBe('user1');
      expect(response.data?.email).toBe('test@example.com');
    });
    
    test('should return error when not authenticated', async () => {
      const authProvider = createMockAuthProvider({
        delayMs: 0
      });
      
      const response = await authProvider.getCurrentUser();
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Not authenticated');
    });
  });
  
  describe('refreshToken functionality', () => {
    test('should refresh the authentication token', async () => {
      const authProvider = createMockAuthProvider({
        delayMs: 0
      });
      
      // Sign in first
      const signInResponse = await authProvider.signIn({
        email: 'test@example.com',
        password: 'password'
      });
      
      const oldToken = signInResponse.data?.token;
      
      // Refresh token
      const response = await authProvider.refreshToken();
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.token).toBeDefined();
      expect(response.data?.token).not.toBe(oldToken);
    });
    
    test('should fail to refresh token when not authenticated', async () => {
      const authProvider = createMockAuthProvider({
        delayMs: 0
      });
      
      const response = await authProvider.refreshToken();
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Not authenticated');
    });
  });
  
  describe('signOut functionality', () => {
    test('should sign out the current user', async () => {
      const authProvider = createMockAuthProvider({
        delayMs: 0
      });
      
      // Sign in first
      await authProvider.signIn({
        email: 'test@example.com',
        password: 'password'
      });
      
      // Verify signed in
      const beforeSignOut = await authProvider.getCurrentUser();
      expect(beforeSignOut.success).toBe(true);
      
      // Sign out
      const response = await authProvider.signOut();
      expect(response.success).toBe(true);
      
      // Verify signed out
      const afterSignOut = await authProvider.getCurrentUser();
      expect(afterSignOut.success).toBe(false);
    });
  });
  
  describe('resetPassword functionality', () => {
    test('should initiate password reset for valid email', async () => {
      const authProvider = createMockAuthProvider({
        users: [
          { id: 'user1', email: 'test@example.com', name: 'Test User' }
        ],
        delayMs: 0
      });
      
      const response = await authProvider.resetPassword('test@example.com');
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.message).toContain('sent to your email');
    });
    
    test('should still return success for non-existent emails', async () => {
      const authProvider = createMockAuthProvider({
        delayMs: 0
      });
      
      const response = await authProvider.resetPassword('nonexistent@example.com');
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.message).toContain('sent to your email');
    });
  });
}); 