/**
 * Socket.IO Global Type Declaration
 *
 * This module centralizes the global Socket.IO type declaration to prevent duplication
 * across modules and ensure type consistency.
 */

// Define the type for global io to avoid TypeScript errors
export interface GlobalIo {
  to: (room: string) => { emit: (event: string, data: unknown) => void };
  emit: (event: string, data: unknown) => void;
  use: (
    middleware: (
      socket: Record<string, unknown>,
      next: (err?: Error) => void
    ) => void
  ) => void;
  on: (
    event: string,
    callback: (socket: Record<string, unknown>) => void
  ) => void;
}

// We're intentionally not declaring global.io here to avoid redeclaration errors
// The actual global.io is provided by the Socket.IO library at runtime

/**
 * Safe accessor for the global io object
 * Provides a type-safe way to access the global io instance
 * @returns The global io instance or null if not available
 */
export const getIo = (): GlobalIo | null => {
  // @ts-expect-error - Access global io which is defined at runtime by Socket.IO
  return typeof global.io !== 'undefined' ? global.io : null;
};

/**
 * Safely emit an event to a room
 * @param room The room to emit to
 * @param event The event name
 * @param data The event data
 */
export const emitToRoom = (
  room: string,
  event: string,
  data: unknown
): void => {
  const io = getIo();
  if (io) {
    io.to(room).emit(event, data);
  } else {
    console.error(`Failed to emit to room: global.io is not available`);
  }
};

/**
 * Safely emit an event to all clients
 * @param event The event name
 * @param data The event data
 */
export const emitToAll = (event: string, data: unknown): void => {
  const io = getIo();
  if (io) {
    io.emit(event, data);
  } else {
    console.error(`Failed to emit to all: global.io is not available`);
  }
};
