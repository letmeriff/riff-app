/**
 * @deprecated Utility functions for vector clock operations in CRDT implementation
 * These functions are maintained for backward compatibility and will be removed in future releases.
 * The Yjs implementation provides built-in CRDT functionality that replaces this custom implementation.
 */

export type VectorClock = Record<string, number>;

/**
 * @deprecated Compare two vector clocks
 * @param vc1 First vector clock
 * @param vc2 Second vector clock
 * @returns 'dominates' if vc1 > vc2, 'dominated' if vc1 < vc2, 
 *          'concurrent' if incomparable, 'equal' if equivalent
 */
export function compareVectorClocks(
  vc1: VectorClock, 
  vc2: VectorClock
): 'dominates' | 'dominated' | 'concurrent' | 'equal' {
  console.warn('Using deprecated compareVectorClocks function - Yjs should be used instead');
  
  let vc1DominatesVc2 = false;
  let vc2DominatesVc1 = false;
  
  // Check all keys in vc1
  for (const key in vc1) {
    if (!(key in vc2)) {
      vc1DominatesVc2 = true;
    } else if (vc1[key] > vc2[key]) {
      vc1DominatesVc2 = true;
    } else if (vc1[key] < vc2[key]) {
      vc2DominatesVc1 = true;
    }
  }
  
  // Check keys in vc2 that are not in vc1
  for (const key in vc2) {
    if (!(key in vc1)) {
      vc2DominatesVc1 = true;
    }
  }
  
  if (vc1DominatesVc2 && !vc2DominatesVc1) {
    return 'dominates';
  } else if (!vc1DominatesVc2 && vc2DominatesVc1) {
    return 'dominated';
  } else if (vc1DominatesVc2 && vc2DominatesVc1) {
    return 'concurrent';
  } else {
    return 'equal';
  }
}

/**
 * @deprecated Merge two vector clocks (take maximum values)
 * @param vc1 First vector clock
 * @param vc2 Second vector clock
 * @returns Merged vector clock
 */
export function mergeVectorClocks(
  vc1: VectorClock, 
  vc2: VectorClock
): VectorClock {
  console.warn('Using deprecated mergeVectorClocks function - Yjs should be used instead');
  
  const result = { ...vc1 };
  
  for (const key in vc2) {
    if (!(key in result) || vc2[key] > result[key]) {
      result[key] = vc2[key];
    }
  }
  
  return result;
}

/**
 * @deprecated Increment a vector clock for a specific user
 * @param vectorClock Vector clock to increment
 * @param userId User ID whose counter should be incremented
 * @returns Updated vector clock
 */
export function incrementVectorClock(
  vectorClock: VectorClock,
  userId: string
): VectorClock {
  console.warn('Using deprecated incrementVectorClock function - Yjs should be used instead');
  
  const newClock = { ...vectorClock };
  newClock[userId] = (newClock[userId] || 0) + 1;
  return newClock;
}

/**
 * @deprecated Generate a Lamport timestamp
 * Uses current time and ensures timestamps are always increasing
 * @returns Lamport timestamp value
 */
let currentLamportTimestamp = Date.now();
export function generateLamportTimestamp(): number {
  console.warn('Using deprecated generateLamportTimestamp function - Yjs should be used instead');
  
  const now = Date.now();
  currentLamportTimestamp = Math.max(now, currentLamportTimestamp + 1);
  return currentLamportTimestamp;
} 