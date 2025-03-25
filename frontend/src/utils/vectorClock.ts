import { VectorClock } from '../types/crdt';

/**
 * Compare two vector clocks to determine their causal relationship
 * 
 * @param vc1 First vector clock
 * @param vc2 Second vector clock
 * @returns 'dominates' if vc1 > vc2, 'dominated' if vc1 < vc2, 
 *          'concurrent' if incomparable, 'equal' if equivalent
 */
export function compareVectorClocks(
  vc1: VectorClock, 
  vc2: VectorClock
): 'dominates' | 'dominated' | 'concurrent' | 'equal' {
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
 * Increment a vector clock for a specific user
 * 
 * @param vectorClock Vector clock to increment
 * @param userId User ID whose counter should be incremented
 * @returns New vector clock with the incremented counter
 */
export function incrementVectorClock(
  vectorClock: VectorClock,
  userId: string
): VectorClock {
  const newClock = { ...vectorClock };
  newClock[userId] = (newClock[userId] || 0) + 1;
  return newClock;
}

/**
 * Merge two vector clocks by taking the maximum value for each key
 * 
 * @param vc1 First vector clock
 * @param vc2 Second vector clock
 * @returns Merged vector clock
 */
export function mergeVectorClocks(
  vc1: VectorClock, 
  vc2: VectorClock
): VectorClock {
  const result = { ...vc1 };
  
  for (const key in vc2) {
    if (!(key in result) || vc2[key] > result[key]) {
      result[key] = vc2[key];
    }
  }
  
  return result;
}

/**
 * Generate a Lamport timestamp
 * Uses current time and ensures timestamps are always increasing
 * 
 * @returns Lamport timestamp value
 */
let currentLamportTimestamp = Date.now();
export function generateLamportTimestamp(): number {
  const now = Date.now();
  currentLamportTimestamp = Math.max(now, currentLamportTimestamp + 1);
  return currentLamportTimestamp;
} 