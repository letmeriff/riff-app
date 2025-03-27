import { supabase } from '../services/supabase';

/**
 * Gets the authentication token from localStorage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

/**
 * Sets the authentication token in localStorage
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

/**
 * Clears the authentication token from localStorage
 */
export const clearAuthToken = (): void => {
  localStorage.removeItem('authToken');
};

/**
 * Refreshes the authentication token using the refresh token
 * If no refresh token is provided, it uses the current session
 */
export const refreshAuthToken = async (refreshToken?: string): Promise<void> => {
  try {
    // If no refresh token provided, try to get it from the current session
    if (!refreshToken) {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        return;
      }
      refreshToken = data.session.refresh_token;
    }

    // Refresh the session with the refresh token
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    
    if (error || !data.session) {
      clearAuthToken();
      return;
    }
    
    // Store the new access token
    setAuthToken(data.session.access_token);
  } catch (error) {
    console.error('Error refreshing token:', error);
    clearAuthToken();
  }
}; 