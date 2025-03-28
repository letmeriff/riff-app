/**
 * Tests for NetworkService
 *
 * This file contains tests for the network services, focusing on payload validation.
 */

import { validatePayload } from './networkService';
import { NetworkPayload } from '../types/messaging';

// Simple type guard for testing
interface TestPayload extends NetworkPayload {
  id: number;
  name: string;
}

function isTestPayload(payload: NetworkPayload): payload is TestPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    typeof payload.id === 'number' &&
    'name' in payload &&
    typeof payload.name === 'string'
  );
}

describe('NetworkService', () => {
  describe('validatePayload', () => {
    test('returns the payload when valid', () => {
      const validPayload: TestPayload = {
        id: 123,
        name: 'Test',
      };

      const result = validatePayload(validPayload, isTestPayload);
      expect(result).toEqual(validPayload);
    });

    test('returns null when payload is invalid', () => {
      const invalidPayload = {
        id: '123', // Wrong type, should be number
        name: 'Test',
      };

      const result = validatePayload(invalidPayload, isTestPayload);
      expect(result).toBeNull();
    });

    test('returns null when payload is missing required properties', () => {
      const invalidPayload = {
        id: 123,
        // Missing 'name' property
      };

      const result = validatePayload(invalidPayload, isTestPayload);
      expect(result).toBeNull();
    });

    test('returns null when payload is null', () => {
      const result = validatePayload(null, isTestPayload);
      expect(result).toBeNull();
    });

    test('returns null when payload is undefined', () => {
      const result = validatePayload(undefined, isTestPayload);
      expect(result).toBeNull();
    });

    test('returns null when payload is not an object', () => {
      const result = validatePayload('not an object', isTestPayload);
      expect(result).toBeNull();
    });

    test('logs error when payload is invalid', () => {
      // Spy on console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const invalidPayload = {
        id: '123', // Wrong type, should be number
        name: 'Test',
      };

      validatePayload(invalidPayload, isTestPayload);

      // Verify console.error was called
      expect(consoleSpy).toHaveBeenCalled();

      // Restore original console.error
      consoleSpy.mockRestore();
    });
  });
});
