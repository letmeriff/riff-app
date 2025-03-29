import { supabase } from '../config/supabase';

/**
 * Verify a user token for WebSocket connections
 * @param token JWT token from the client
 * @returns User object if valid, null if invalid
 */
export const verifyUserToken = async (token: string) => {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      console.error('Token verification failed:', error);
      return null;
    }
    
    return data.user;
  } catch (err) {
    console.error('Exception verifying token:', err);
    return null;
  }
}; 