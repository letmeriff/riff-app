import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { VectorClock, NodePositionOperation } from './crdt';
import { mergeVectorClocks } from './vectorClock';
import { initCRDTAdapter } from '../services/crdtPositionAdapter';

/**
 * @deprecated Context interface for CRDT operations
 * This context is maintained for backward compatibility and will be removed in future releases.
 * Use the YjsContext for new development.
 */
interface CRDTContextType {
  nodeVectorClocks: Map<string, VectorClock>;
  pendingOperations: Map<string, NodePositionOperation[]>;
  updateNodeVectorClock: (nodeId: string, vectorClock: VectorClock) => void;
  getNodeVectorClock: (nodeId: string) => VectorClock;
  addPendingOperation: (operation: NodePositionOperation) => void;
  removePendingOperation: (nodeId: string, lamportTimestamp: number) => void;
  hasPendingOperations: (nodeId: string) => boolean;
  isConnected: boolean; // Added for compatibility with YjsContext interface
  nodePositions: {[nodeId: string]: {x: number, y: number}};
}

const CRDTContext = createContext<CRDTContextType | undefined>(undefined);

/**
 * @deprecated Provider component for CRDT functionality
 * This provider is maintained for backward compatibility and will be removed in future releases.
 * Use the YjsProvider for new development.
 */
export const CRDTProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.warn('Using deprecated CRDTProvider - Switch to YjsProvider for new development');
  
  const [nodeVectorClocks, setNodeVectorClocks] = useState<Map<string, VectorClock>>(new Map());
  const [pendingOperations, setPendingOperations] = useState<Map<string, NodePositionOperation[]>>(new Map());
  const [isConnected, setIsConnected] = useState<boolean>(true); // Always true for CRDT
  const [nodePositions, setNodePositions] = useState<{[nodeId: string]: {x: number, y: number}}>({});

  /**
   * Update vector clock for a node
   */
  const updateNodeVectorClock = useCallback((nodeId: string, vectorClock: VectorClock) => {
    setNodeVectorClocks(prev => {
      const newMap = new Map(prev);
      const existingClock = newMap.get(nodeId) || {};
      
      // Merge the existing and new vector clocks
      const mergedClock = mergeVectorClocks(existingClock, vectorClock);
      newMap.set(nodeId, mergedClock);
      
      return newMap;
    });
  }, []);

  /**
   * Get vector clock for a node
   */
  const getNodeVectorClock = useCallback((nodeId: string): VectorClock => {
    return nodeVectorClocks.get(nodeId) || {};
  }, [nodeVectorClocks]);

  /**
   * Add pending operation
   */
  const addPendingOperation = useCallback((operation: NodePositionOperation) => {
    setPendingOperations(prev => {
      const newMap = new Map(prev);
      const existingOps = newMap.get(operation.nodeId) || [];
      
      // Add new operation
      newMap.set(operation.nodeId, [...existingOps, operation]);
      
      // Also update node positions cache
      setNodePositions(prevPositions => ({
        ...prevPositions,
        [operation.nodeId]: operation.position
      }));
      
      return newMap;
    });
  }, []);

  /**
   * Remove pending operation
   */
  const removePendingOperation = useCallback((nodeId: string, lamportTimestamp: number) => {
    setPendingOperations(prev => {
      const newMap = new Map(prev);
      const existingOps = newMap.get(nodeId) || [];
      
      // Filter out the operation with matching lamport timestamp
      const filteredOps = existingOps.filter(op => op.lamportTimestamp !== lamportTimestamp);
      
      if (filteredOps.length > 0) {
        newMap.set(nodeId, filteredOps);
      } else {
        newMap.delete(nodeId);
      }
      
      return newMap;
    });
  }, []);

  /**
   * Check if there are pending operations for a node
   */
  const hasPendingOperations = useCallback((nodeId: string): boolean => {
    const ops = pendingOperations.get(nodeId);
    return !!ops && ops.length > 0;
  }, [pendingOperations]);

  // Initialize the CRDT adapter with this context
  useEffect(() => {
    const contextValue = {
      nodeVectorClocks,
      pendingOperations,
      updateNodeVectorClock,
      getNodeVectorClock,
      addPendingOperation,
      removePendingOperation,
      hasPendingOperations,
      isConnected,
      nodePositions
    };
    
    initCRDTAdapter(contextValue);
  }, [
    nodeVectorClocks, 
    pendingOperations, 
    updateNodeVectorClock, 
    getNodeVectorClock, 
    addPendingOperation, 
    removePendingOperation, 
    hasPendingOperations,
    isConnected,
    nodePositions
  ]);

  return (
    <CRDTContext.Provider
      value={{
        nodeVectorClocks,
        pendingOperations,
        updateNodeVectorClock,
        getNodeVectorClock,
        addPendingOperation,
        removePendingOperation,
        hasPendingOperations,
        isConnected,
        nodePositions
      }}
    >
      {children}
    </CRDTContext.Provider>
  );
};

/**
 * @deprecated Hook for using CRDT functionality
 * This hook is maintained for backward compatibility and will be removed in future releases.
 * Use the useYjs hook for new development.
 */
export const useCRDT = () => {
  const context = useContext(CRDTContext);
  if (!context) throw new Error('useCRDT must be used within a CRDTProvider');
  return context;
}; 