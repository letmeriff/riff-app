import {
  compareVectorClocks,
  incrementVectorClock,
  mergeVectorClocks,
  generateLamportTimestamp
} from './vectorClock';
import { VectorClock } from '../types/crdt';

describe('vectorClock utilities', () => {
  describe('compareVectorClocks', () => {
    it('returns "equal" for identical vector clocks', () => {
      const vc1: VectorClock = { user1: 1, user2: 2 };
      const vc2: VectorClock = { user1: 1, user2: 2 };
      
      expect(compareVectorClocks(vc1, vc2)).toBe('equal');
    });
    
    it('returns "dominates" when first clock dominates second', () => {
      const vc1: VectorClock = { user1: 2, user2: 2 };
      const vc2: VectorClock = { user1: 1, user2: 2 };
      
      expect(compareVectorClocks(vc1, vc2)).toBe('dominates');
    });
    
    it('returns "dominated" when second clock dominates first', () => {
      const vc1: VectorClock = { user1: 1, user2: 2 };
      const vc2: VectorClock = { user1: 1, user2: 3 };
      
      expect(compareVectorClocks(vc1, vc2)).toBe('dominated');
    });
    
    it('returns "concurrent" when clocks are concurrent', () => {
      const vc1: VectorClock = { user1: 2, user2: 1 };
      const vc2: VectorClock = { user1: 1, user2: 2 };
      
      expect(compareVectorClocks(vc1, vc2)).toBe('concurrent');
    });
    
    it('handles additional keys in first clock', () => {
      const vc1: VectorClock = { user1: 1, user2: 2, user3: 1 };
      const vc2: VectorClock = { user1: 1, user2: 2 };
      
      expect(compareVectorClocks(vc1, vc2)).toBe('dominates');
    });
    
    it('handles additional keys in second clock', () => {
      const vc1: VectorClock = { user1: 1, user2: 2 };
      const vc2: VectorClock = { user1: 1, user2: 2, user3: 1 };
      
      expect(compareVectorClocks(vc1, vc2)).toBe('dominated');
    });
  });
  
  describe('incrementVectorClock', () => {
    it('increments counter for existing user', () => {
      const vc: VectorClock = { user1: 1, user2: 2 };
      const newVc = incrementVectorClock(vc, 'user1');
      
      expect(newVc).toEqual({ user1: 2, user2: 2 });
    });
    
    it('creates and sets counter to 1 for new user', () => {
      const vc: VectorClock = { user1: 1, user2: 2 };
      const newVc = incrementVectorClock(vc, 'user3');
      
      expect(newVc).toEqual({ user1: 1, user2: 2, user3: 1 });
    });
    
    it('does not modify the original vector clock', () => {
      const vc: VectorClock = { user1: 1, user2: 2 };
      incrementVectorClock(vc, 'user1');
      
      expect(vc).toEqual({ user1: 1, user2: 2 });
    });
  });
  
  describe('mergeVectorClocks', () => {
    it('takes maximum value for each key', () => {
      const vc1: VectorClock = { user1: 1, user2: 3, user3: 1 };
      const vc2: VectorClock = { user1: 2, user2: 2, user4: 1 };
      
      const merged = mergeVectorClocks(vc1, vc2);
      
      expect(merged).toEqual({
        user1: 2,
        user2: 3,
        user3: 1,
        user4: 1
      });
    });
    
    it('returns first clock when it dominates second', () => {
      const vc1: VectorClock = { user1: 2, user2: 3 };
      const vc2: VectorClock = { user1: 1, user2: 2 };
      
      const merged = mergeVectorClocks(vc1, vc2);
      
      expect(merged).toEqual({ user1: 2, user2: 3 });
    });
    
    it('does not modify original clocks', () => {
      const vc1: VectorClock = { user1: 1, user2: 3 };
      const vc2: VectorClock = { user1: 2, user2: 2 };
      
      mergeVectorClocks(vc1, vc2);
      
      expect(vc1).toEqual({ user1: 1, user2: 3 });
      expect(vc2).toEqual({ user1: 2, user2: 2 });
    });
  });
  
  describe('generateLamportTimestamp', () => {
    it('returns increasing timestamps on subsequent calls', () => {
      const ts1 = generateLamportTimestamp();
      const ts2 = generateLamportTimestamp();
      const ts3 = generateLamportTimestamp();
      
      expect(ts2).toBeGreaterThan(ts1);
      expect(ts3).toBeGreaterThan(ts2);
    });
    
    it('returns timestamp not less than current time', () => {
      const now = Date.now();
      const ts = generateLamportTimestamp();
      
      // Allow for small time differences due to test execution time
      expect(ts).toBeGreaterThanOrEqual(now - 5);
    });
  });
}); 