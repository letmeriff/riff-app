/**
 * Unit tests for type guards
 * 
 * Tests each type guard function to ensure proper payload validation.
 */

import { 
  isMessageUpdatePayload,
  isPresenceUpdatePayload,
  isOwnershipUpdatePayload,
  parseNodeId,
  compareNodeIds,
  ensureNumericId
} from './typeGuards';
import { NetworkPayload } from '../types/messaging';

describe('Type Guards', () => {
  describe('isMessageUpdatePayload', () => {
    it('should return true for valid message update payload', () => {
      const payload: NetworkPayload = {
        new: {
          node_id: 123,
          message_id: 456,
          content: 'Test message',
          is_user: true,
          timestamp: '2023-01-01T00:00:00Z'
        }
      };
      
      expect(isMessageUpdatePayload(payload)).toBe(true);
    });
    
    it('should return false if new property is missing', () => {
      const payload: NetworkPayload = {
        someOtherProperty: 'value'
      };
      
      expect(isMessageUpdatePayload(payload)).toBe(false);
    });
    
    it('should return false if new property is null', () => {
      const payload: NetworkPayload = {
        new: null
      };
      
      expect(isMessageUpdatePayload(payload)).toBe(false);
    });
    
    it('should return false if node_id is missing in new', () => {
      const payload: NetworkPayload = {
        new: {
          message_id: 456,
          content: 'Test message',
          is_user: true,
          timestamp: '2023-01-01T00:00:00Z'
        }
      };
      
      expect(isMessageUpdatePayload(payload)).toBe(false);
    });
  });
  
  describe('isPresenceUpdatePayload', () => {
    it('should return true for valid presence update payload', () => {
      const payload: NetworkPayload = {
        nodeId: 123,
        presence: [
          {
            userId: 'user1',
            email: 'user1@example.com',
            isTyping: true,
            lastActive: '2023-01-01T00:00:00Z'
          }
        ]
      };
      
      expect(isPresenceUpdatePayload(payload)).toBe(true);
    });
    
    it('should return false if nodeId is missing', () => {
      const payload: NetworkPayload = {
        presence: [
          {
            userId: 'user1',
            email: 'user1@example.com',
            isTyping: true,
            lastActive: '2023-01-01T00:00:00Z'
          }
        ]
      };
      
      expect(isPresenceUpdatePayload(payload)).toBe(false);
    });
    
    it('should return false if presence is missing', () => {
      const payload: NetworkPayload = {
        nodeId: 123
      };
      
      expect(isPresenceUpdatePayload(payload)).toBe(false);
    });
    
    it('should return false if presence is not an array', () => {
      const payload: NetworkPayload = {
        nodeId: 123,
        presence: 'not an array'
      };
      
      expect(isPresenceUpdatePayload(payload)).toBe(false);
    });
  });
  
  describe('isOwnershipUpdatePayload', () => {
    it('should return true for valid ownership update payload', () => {
      const payload: NetworkPayload = {
        nodeId: 123,
        ownerId: 'user1'
      };
      
      expect(isOwnershipUpdatePayload(payload)).toBe(true);
    });
    
    it('should return false if nodeId is missing', () => {
      const payload: NetworkPayload = {
        ownerId: 'user1'
      };
      
      expect(isOwnershipUpdatePayload(payload)).toBe(false);
    });
    
    it('should return false if ownerId is missing', () => {
      const payload: NetworkPayload = {
        nodeId: 123
      };
      
      expect(isOwnershipUpdatePayload(payload)).toBe(false);
    });
  });

  describe('parseNodeId', () => {
    it('should return null for null input', () => {
      expect(parseNodeId(null)).toBeNull();
    });
    
    it('should return numeric node ID for valid string input', () => {
      expect(parseNodeId('123')).toBe(123);
    });
    
    it('should return null for invalid numeric string', () => {
      expect(parseNodeId('abc')).toBeNull();
    });
  });
  
  describe('compareNodeIds', () => {
    it('should return true when numeric ID matches string ID', () => {
      expect(compareNodeIds(123, '123')).toBe(true);
    });
    
    it('should return false when IDs do not match', () => {
      expect(compareNodeIds(123, '456')).toBe(false);
    });
    
    it('should return false when string ID is null', () => {
      expect(compareNodeIds(123, null)).toBe(false);
    });
  });
  
  describe('ensureNumericId', () => {
    it('should return the same number when given a number', () => {
      expect(ensureNumericId(123)).toBe(123);
    });
    
    it('should convert string to number when given a numeric string', () => {
      expect(ensureNumericId('123')).toBe(123);
    });
    
    it('should return null when given null', () => {
      expect(ensureNumericId(null)).toBeNull();
    });
    
    it('should return null for invalid numeric string', () => {
      expect(ensureNumericId('abc')).toBeNull();
    });
  });
}); 