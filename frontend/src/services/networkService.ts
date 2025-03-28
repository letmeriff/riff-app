/**
 * Network Service
 *
 * This module provides utilities for validating and processing network payloads,
 * ensuring type safety at API boundaries.
 */

import { NetworkPayload } from '../types/messaging';

/**
 * Validate incoming network payload before processing
 */
export function validatePayload<T extends NetworkPayload>(
  payload: unknown,
  typeGuard: (payload: NetworkPayload) => payload is T
): T | null {
  if (!payload || typeof payload !== 'object') {
    console.error('Invalid payload received:', payload);
    return null;
  }

  try {
    if (!typeGuard(payload as NetworkPayload)) {
      console.error('Payload failed type validation:', payload);
      return null;
    }

    return payload as T;
  } catch (error) {
    console.error('Error during payload validation:', error);
    return null;
  }
}

/**
 * Create a payload with consistent structure
 */
export function createTypedPayload<T extends NetworkPayload>(data: T): T {
  return data;
}
