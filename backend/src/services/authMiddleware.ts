/**
 * Authentication middleware for WebSocket connections
 *
 * This module provides authentication functionality for Socket.IO connections
 */

import { supabase } from '../config/supabase';
import { SocketData } from './webSocketService';

/**
 * Authentication middleware for Socket.IO
 *
 * @param socket Socket instance
 * @param next Next function to call
 */
export const authMiddleware = async (
  socket: {
    handshake: { auth: { token?: string } };
    data: SocketData;
  },
  next: (err?: Error) => void
) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      return next(new Error('Authentication error: Invalid token'));
    }

    // Store simplified user data
    socket.data.user = {
      id: user.id,
      email: user.email,
    };
    next();
  } catch (error) {
    next(
      new Error(
        'Authentication error: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
    );
  }
};
