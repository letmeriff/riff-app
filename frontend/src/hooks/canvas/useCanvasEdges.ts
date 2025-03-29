/**
 * useCanvasEdges Hook
 * 
 * This hook provides state management and operations for canvas edges.
 * It handles edge creation, deletion, and connection operations.
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  useEdgesState, 
  EdgeChange, 
  Connection, 
  Edge,
  addEdge as reactFlowAddEdge
} from 'reactflow';
import { useYjs } from '../../contexts/YjsContext';
import { 
  CanvasEdge, 
  CanvasEdgeData,
  UseCanvasEdgesResult 
} from '../../types/canvas';
import { syncEdgeChangesToYjs, syncEdgeDeletionToYjs } from '../../utils/reactFlowYjsBinding';
import {
  getContextPullsForNode,
  getNodesPullingFromNode,
  ContextPull
} from '../../services/contextPullService';
import { supabase } from '../../services/supabase';

/**
 * Custom hook for managing canvas edges
 * Provides functionality for creating, connecting, and deleting edges
 */
export function useCanvasEdges(): UseCanvasEdgesResult {
  // Use ReactFlow's built-in edge state management
  const [edgesInternal, setEdgesInternal, onEdgesChangeInternal] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Context hooks
  const yjs = useYjs();
  
  // Type-safe wrapper functions for ReactFlow edges
  const edges = edgesInternal as unknown as CanvasEdge[];
  const setEdges = setEdgesInternal as unknown as React.Dispatch<React.SetStateAction<CanvasEdge[]>>;
  
  // Load edges on initialization
  useEffect(() => {
    const loadEdges = async () => {
      try {
        // Try to load from Yjs first if available
        if (yjs && yjs.isConnected && yjs.ydoc) {
          const yjsEdges = yjs.getEdgesFromYjs();
          
          if (yjsEdges.length > 0) {
            setEdges(yjsEdges as CanvasEdge[]);
            setLoading(false);
            return;
          }
        }
        
        // Fallback to loading from backend
        // Since we don't have a direct API to fetch all context pulls, we'll load them directly from Supabase
        const { data: contextPulls, error: pullsError } = await supabase
          .from('context_pulls')
          .select('*');
        
        if (pullsError) throw pullsError;
        
        if (contextPulls && contextPulls.length > 0) {
          // Create edges from context pulls
          const reactFlowEdges: CanvasEdge[] = contextPulls.map((pull: ContextPull) => ({
            id: `edge-${pull.origin_node_id}-${pull.target_node_id}`,
            source: pull.origin_node_id.toString(),
            target: pull.target_node_id.toString(),
            type: 'straight',
            animated: true,
            data: {
              type: 'context-pull',
              lastPulledAt: pull.last_pulled_at,
              createdAt: pull.created_at
            } as CanvasEdgeData
          }));
          
          setEdges(reactFlowEdges);
        }
      } catch (err) {
        console.error('Error loading edges:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    
    loadEdges();
  }, [yjs, setEdges]);
  
  // Custom onEdgesChange handler with Yjs integration
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (yjs && yjs.ydoc) {
        // Use ReactFlow-Yjs binding to sync edge changes to Yjs
        setEdges((currentEdges) => syncEdgeChangesToYjs(changes, currentEdges as Edge[], yjs.ydoc) as CanvasEdge[]);
        
        // Handle edge removals separately
        changes.forEach(change => {
          if (change.type === 'remove') {
            syncEdgeDeletionToYjs(change.id, yjs.ydoc);
          }
        });
      } else {
        // If Yjs is not available, just use the standard ReactFlow handler
        onEdgesChangeInternal(changes);
      }
    },
    [yjs, setEdges, onEdgesChangeInternal]
  );
  
  // Handle ReactFlow connection events
  const onConnect = useCallback(
    (connection: Connection) => {
      // Validate the connection
      if (!connection.source || !connection.target) return;
      
      try {
        // Create a new edge using ReactFlow's addEdge utility
        setEdges((currentEdges) => {
          const newEdges = reactFlowAddEdge(
            {
              ...connection,
              type: 'straight',
              animated: true,
              data: {
                type: 'context-pull',
                createdAt: new Date().toISOString()
              }
            }, 
            currentEdges as Edge[]
          ) as CanvasEdge[];
          
          // If using Yjs, sync the new edge
          if (yjs && yjs.ydoc) {
            const newEdge = newEdges.find(edge => 
              edge.source === connection.source && 
              edge.target === connection.target
            );
            
            if (newEdge) {
              // TODO: Add API call to create context pull in database
              // This will be implemented in a separate ticket
            }
          }
          
          return newEdges;
        });
      } catch (err) {
        console.error('Error connecting nodes:', err);
        setError(err as Error);
      }
    },
    [setEdges, yjs]
  );
  
  // Create a new edge directly (not through user interaction)
  const createEdge = useCallback(
    (source: string, target: string, data?: CanvasEdgeData): CanvasEdge | null => {
      if (!source || !target) return null;
      
      try {
        const newEdge: CanvasEdge = {
          id: `edge-${source}-${target}`,
          source,
          target,
          type: 'straight',
          animated: true,
          data: data || {
            type: 'context-pull',
            createdAt: new Date().toISOString()
          }
        };
        
        setEdges(currentEdges => [...currentEdges, newEdge]);
        
        // If using Yjs, sync the new edge
        if (yjs && yjs.ydoc) {
          // TODO: Add Yjs sync for new edge
          // This will be implemented using the mapEdgeToYjs utility
        }
        
        // TODO: Add API call to create context pull in database
        // This will be implemented in a separate ticket
        
        return newEdge;
      } catch (err) {
        console.error('Error creating edge:', err);
        setError(err as Error);
        return null;
      }
    },
    [setEdges, yjs]
  );
  
  // Delete an edge
  const deleteEdge = useCallback(
    (edgeId: string): boolean => {
      try {
        // Remove from local state
        setEdges(currentEdges => currentEdges.filter(edge => edge.id !== edgeId));
        
        // If using Yjs, sync the deletion
        if (yjs && yjs.ydoc) {
          syncEdgeDeletionToYjs(edgeId, yjs.ydoc);
        }
        
        // TODO: Add API call to delete context pull from database
        // This will be implemented in a separate ticket
        
        return true;
      } catch (err) {
        console.error('Error deleting edge:', err);
        setError(err as Error);
        return false;
      }
    },
    [setEdges, yjs]
  );
  
  return {
    edges,
    setEdges,
    onEdgesChange,
    onConnect,
    createEdge,
    deleteEdge,
    loading,
    error
  };
} 