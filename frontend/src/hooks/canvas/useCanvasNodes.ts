/**
 * useCanvasNodes Hook
 * 
 * This hook provides state management and operations for canvas nodes.
 * It handles node creation, updating, deletion, and synchronization with the backend.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNodesState, NodeChange, XYPosition, Node } from 'reactflow';
import { useAuth } from '../../contexts/AuthContext';
import { useYjs } from '../../contexts/YjsContext';
import { 
  fetchNodes, 
  createNode as createNodeService, 
  deleteNode as deleteNodeService, 
  updateNodePosition as updateNodePositionService,
  ChatNode
} from '../../services/nodeService';
import { 
  CanvasNode, 
  CanvasNodeData, 
  UseCanvasNodesResult, 
  PulledConnection, 
  PulledByConnection,
  NodeAttachment,
  UserPresence 
} from '../../types/canvas';
import { syncNodeChangesToYjs, syncNodeDeletionToYjs } from '../../utils/reactFlowYjsBinding';
import { debounce } from 'lodash';

/**
 * Custom hook for managing canvas nodes
 * Provides functionality for loading, creating, updating, and deleting nodes
 */
export function useCanvasNodes(): UseCanvasNodesResult {
  // Use ReactFlow's built-in node state management
  const [nodesInternal, setNodesInternal, onNodesChangeInternal] = useNodesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Context hooks
  const { user } = useAuth();
  const yjs = useYjs();
  
  // Type-safe wrapper functions for ReactFlow nodes
  const nodes = nodesInternal as unknown as CanvasNode[];
  const setNodes = setNodesInternal as unknown as React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  
  // Load nodes on initialization
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const loadNodes = async () => {
      try {
        // Try to load from Yjs first if available
        if (yjs && yjs.isConnected && yjs.ydoc) {
          const yjsNodes = yjs.getNodesFromYjs();
          
          if (yjsNodes.length > 0) {
            setNodes(yjsNodes as CanvasNode[]);
            setLoading(false);
            return;
          }
        }
        
        // Fallback to loading from backend
        const chatNodes = await fetchNodes();
        
        // Transform the database nodes to ReactFlow nodes
        const reactFlowNodes: CanvasNode[] = chatNodes.map((chatNode: ChatNode) => {
          // Determine the node position from database or default
          const nodeId = chatNode.node_id.toString();
          let position = { x: 0, y: 0 };
          
          if (chatNode.position_x !== null && chatNode.position_y !== null && 
              typeof chatNode.position_x === 'number' && typeof chatNode.position_y === 'number') {
            position = {
              x: chatNode.position_x,
              y: chatNode.position_y
            };
          } else {
            position = { x: 100, y: 100 };
          }
          
          return {
            id: nodeId,
            type: 'chatNode',
            position: position,
            data: {
              label: chatNode.title,
              content: chatNode.description || '',
              nodeId: chatNode.node_id,
              createdAt: chatNode.created_at,
              createdBy: chatNode.user_id,
              pulledConnections: [] as PulledConnection[],
              pulledByConnections: [] as PulledByConnection[],
              userPresence: [] as UserPresence[],
              attachments: [] as NodeAttachment[]
            } as CanvasNodeData,
          };
        });
        
        setNodes(reactFlowNodes);
      } catch (err) {
        console.error('Error loading nodes:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    
    loadNodes();
  }, [user, yjs, setNodes]);
  
  // Custom onNodesChange handler with Yjs integration
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (yjs && yjs.ydoc) {
        // Use ReactFlow-Yjs binding to sync node changes to Yjs
        setNodes((currentNodes) => syncNodeChangesToYjs(changes, currentNodes as Node[], yjs.ydoc) as CanvasNode[]);
        
        // Handle node removals separately
        changes.forEach(change => {
          if (change.type === 'remove') {
            syncNodeDeletionToYjs(change.id, yjs.ydoc);
          }
        });
      } else {
        // If Yjs is not available, just use the standard ReactFlow handler
        onNodesChangeInternal(changes);
      }
    },
    [yjs, setNodes, onNodesChangeInternal]
  );
  
  // Create a new node
  const createNodeImpl = useCallback(async (position?: XYPosition) => {
    if (!user) return null;
    
    try {
      // Default position if not provided
      const nodePosition = position || {
        x: Math.random() * 500,
        y: Math.random() * 500
      };
      
      // Create node in the backend
      const newChatNode = await createNodeService(
        user.id,
        'New Node',
        'gpt-4',
        'default',
        'Empty node'
      );
      
      // Create ReactFlow node representation
      const newNode: CanvasNode = {
        id: newChatNode.node_id.toString(),
        type: 'chatNode',
        position: {
          x: nodePosition.x,
          y: nodePosition.y
        },
        data: {
          label: newChatNode.title,
          content: newChatNode.description || '',
          nodeId: newChatNode.node_id,
          createdAt: newChatNode.created_at,
          createdBy: newChatNode.user_id,
          pulledConnections: [],
          pulledByConnections: [],
          userPresence: [],
          attachments: []
        } as CanvasNodeData
      };
      
      // Add to nodes state
      setNodes(current => [...current, newNode]);
      
      // If using Yjs, sync the new node
      if (yjs && yjs.ydoc) {
        const mapNodeToYjs = (await import('../../services/yjsService')).mapNodeToYjs;
        mapNodeToYjs(newNode, newChatNode);
      }
      
      return newNode;
    } catch (err) {
      console.error('Error creating node:', err);
      setError(err as Error);
      return null;
    }
  }, [user, setNodes, yjs]);
  
  // Update node content
  const updateNodeContent = useCallback((nodeId: string, content: string) => {
    setNodes(currentNodes =>
      currentNodes.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              content
            }
          };
        }
        return node;
      })
    );
    
    // TODO: Add backend sync for content updates
    // This will be implemented in a separate ticket
  }, [setNodes]);
  
  // Update node position with debounce to avoid excessive updates
  const updateNodePositionImpl = useCallback(
    debounce((nodeId: string, position: XYPosition) => {
      // Update in ReactFlow state first
      setNodes(currentNodes =>
        currentNodes.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              position
            };
          }
          return node;
        })
      );
      
      // Then update in backend
      updateNodePositionService(parseInt(nodeId), position)
        .then((result) => {
          if (!result.success) {
            console.error(`Failed to update position for node ${nodeId}`);
          }
        })
        .catch((err) => {
          console.error('Error updating node position:', err);
          setError(err);
        });
    }, 50),
    [setNodes]
  );
  
  // Delete a node
  const deleteNodeImpl = useCallback(async (nodeId: string) => {
    try {
      // Delete from backend
      await deleteNodeService(parseInt(nodeId));
      
      // Remove from local state
      setNodes(currentNodes => currentNodes.filter(node => node.id !== nodeId));
      
      // If using Yjs, sync the deletion
      if (yjs && yjs.ydoc) {
        syncNodeDeletionToYjs(nodeId, yjs.ydoc);
      }
      
      return true;
    } catch (err) {
      console.error('Error deleting node:', err);
      setError(err as Error);
      return false;
    }
  }, [setNodes, yjs]);
  
  return {
    nodes,
    setNodes,
    onNodesChange,
    createNode: createNodeImpl,
    updateNodeContent,
    updateNodePosition: updateNodePositionImpl,
    deleteNode: deleteNodeImpl,
    loading,
    error
  };
} 