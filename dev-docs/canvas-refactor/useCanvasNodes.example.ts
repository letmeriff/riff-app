import { useState, useCallback, useEffect } from 'react';
import { Node } from 'reactflow';
import { ChatNode } from '../../frontend/src/services/nodeService';
import { useYjs } from '../../frontend/src/contexts/YjsContext';
import { useAuth } from '../../frontend/src/contexts/AuthContext';
import * as nodeService from '../../frontend/src/services/nodeService';

/**
 * Custom hook for managing canvas nodes with Yjs integration
 */
export interface UseCanvasNodesOptions {
  /** Initial nodes to populate the canvas with */
  initialNodes?: Node[];
  /** Enable Yjs integration */
  enableYjs?: boolean;
  /** Enable auto-save to database */
  enableAutoSave?: boolean;
  /** Canvas ID for node association */
  canvasId?: string;
}

export interface UseCanvasNodesReturn {
  /** Current nodes in the canvas */
  nodes: Node[];
  /** Loading state indicator */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Create a new node */
  createNode: (title: string, options?: { model?: string, flavor?: string, description?: string }) => Promise<Node>;
  /** Update an existing node */
  updateNode: (nodeId: string, data: Partial<ChatNode>) => Promise<boolean>;
  /** Delete a node */
  deleteNode: (nodeId: string) => Promise<boolean>;
  /** Get node by ID */
  getNodeById: (nodeId: string) => Node | undefined;
  /** Update multiple nodes at once */
  batchUpdateNodes: (updates: Array<{ id: string, data: Partial<ChatNode> }>) => Promise<boolean>;
  /** Refresh nodes from data source */
  refreshNodes: () => Promise<void>;
  /** Set nodes directly (use with caution) */
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

/**
 * Hook for managing canvas nodes with Yjs integration
 */
export const useCanvasNodes = ({
  initialNodes = [],
  enableYjs = true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  enableAutoSave = true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canvasId = 'default',
}: UseCanvasNodesOptions = {}): UseCanvasNodesReturn => {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const yjs = useYjs();

  // Track chat node data separately for easy access
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [chatNodes, setChatNodes] = useState<Record<string, ChatNode>>({});

  /**
   * Load nodes from the appropriate data source
   */
  const loadNodes = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try loading from Yjs first if enabled
      if (enableYjs && yjs && yjs.isConnected && yjs.ydoc) {
        const yjsNodes = yjs.getNodesFromYjs();
        if (yjsNodes.length > 0) {
          setNodes(yjsNodes);
          setLoading(false);
          return;
        }
      }

      // Fallback to database loading
      const fetchedNodes = await nodeService.fetchNodes();
      
      // Transform database nodes to ReactFlow format
      const reactFlowNodes: Node[] = fetchedNodes.map((chatNode: ChatNode) => ({
        id: chatNode.node_id.toString(),
        position: {
          x: chatNode.position_x || 0,
          y: chatNode.position_y || 0
        },
        type: 'chatNode',
        data: {
          label: chatNode.title,
          nodeId: chatNode.node_id,
          title: chatNode.title,
          model: chatNode.model,
          flavor: chatNode.flavor,
          description: chatNode.description,
          chatNode: chatNode
        }
      }));

      // Update state
      setNodes(reactFlowNodes);
      
      // Update chat nodes record
      const chatNodesRecord: Record<string, ChatNode> = {};
      fetchedNodes.forEach((node: ChatNode) => {
        chatNodesRecord[node.node_id.toString()] = node;
      });
      setChatNodes(chatNodesRecord);
      
      // If Yjs is enabled but empty, populate it with our loaded nodes
      if (enableYjs && yjs && yjs.isConnected && yjs.ydoc) {
        // Sync to Yjs would happen here
      }
    } catch (err) {
      console.error('Error loading nodes:', err);
      setError(err instanceof Error ? err : new Error('Failed to load nodes'));
    } finally {
      setLoading(false);
    }
  }, [user, yjs, enableYjs]);

  /**
   * Create a new node
   */
  const createNode = useCallback(async (
    title: string,
    options: { model?: string, flavor?: string, description?: string } = {}
  ): Promise<Node> => {
    if (!user) {
      throw new Error('User must be authenticated to create nodes');
    }

    try {
      // Create in database
      const newChatNode = await nodeService.createNode(
        user.id,
        title,
        options.model,
        options.flavor,
        options.description
      );

      // Create ReactFlow node
      const newNode: Node = {
        id: newChatNode.node_id.toString(),
        position: {
          x: newChatNode.position_x || 0,
          y: newChatNode.position_y || 0
        },
        type: 'chatNode',
        data: {
          label: newChatNode.title,
          nodeId: newChatNode.node_id,
          title: newChatNode.title,
          model: newChatNode.model,
          flavor: newChatNode.flavor,
          description: newChatNode.description,
          chatNode: newChatNode
        }
      };

      // Update state
      setNodes(currentNodes => [...currentNodes, newNode]);
      setChatNodes(current => ({
        ...current,
        [newChatNode.node_id.toString()]: newChatNode
      }));

      // Sync to Yjs if enabled
      if (enableYjs && yjs && yjs.isConnected && yjs.ydoc) {
        // Sync to Yjs would happen here
      }

      return newNode;
    } catch (err) {
      console.error('Error creating node:', err);
      throw err instanceof Error ? err : new Error('Failed to create node');
    }
  }, [user, yjs, enableYjs]);

  /**
   * Update an existing node
   */
  const updateNode = useCallback(async (
    nodeId: string,
    data: Partial<ChatNode>
  ): Promise<boolean> => {
    try {
      const numericNodeId = parseInt(nodeId, 10);
      
      // Update title if provided
      if (data.title) {
        await nodeService.updateNodeTitle(numericNodeId, data.title);
      }
      
      // Update description if provided
      if (data.description) {
        await nodeService.updateNodeDescription(numericNodeId, data.description);
      }
      
      // Update state
      setNodes(currentNodes => 
        currentNodes.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...data,
                label: data.title || node.data.label
              }
            };
          }
          return node;
        })
      );
      
      // Update chat nodes record
      setChatNodes(current => {
        const existingNode = current[nodeId];
        if (existingNode) {
          return {
            ...current,
            [nodeId]: {
              ...existingNode,
              ...data
            }
          };
        }
        return current;
      });
      
      // Sync to Yjs if enabled
      if (enableYjs && yjs && yjs.isConnected && yjs.ydoc) {
        // Sync to Yjs would happen here
      }
      
      return true;
    } catch (err) {
      console.error('Error updating node:', err);
      return false;
    }
  }, [yjs, enableYjs]);

  /**
   * Delete a node
   */
  const deleteNode = useCallback(async (nodeId: string): Promise<boolean> => {
    try {
      const numericNodeId = parseInt(nodeId, 10);
      
      // Delete from database
      await nodeService.deleteNode(numericNodeId);
      
      // Update state
      setNodes(currentNodes => 
        currentNodes.filter(node => node.id !== nodeId)
      );
      
      // Update chat nodes record
      setChatNodes(current => {
        const { [nodeId]: _, ...rest } = current;
        return rest;
      });
      
      // Sync to Yjs if enabled
      if (enableYjs && yjs && yjs.isConnected && yjs.ydoc) {
        // Sync to Yjs would happen here
      }
      
      return true;
    } catch (err) {
      console.error('Error deleting node:', err);
      return false;
    }
  }, [yjs, enableYjs]);

  /**
   * Get a node by ID
   */
  const getNodeById = useCallback((nodeId: string): Node | undefined => {
    return nodes.find(node => node.id === nodeId);
  }, [nodes]);

  /**
   * Batch update multiple nodes
   */
  const batchUpdateNodes = useCallback(async (
    updates: Array<{ id: string, data: Partial<ChatNode> }>
  ): Promise<boolean> => {
    try {
      // Update nodes in database (could be optimized with a batch update API)
      for (const update of updates) {
        const numericNodeId = parseInt(update.id, 10);
        
        if (update.data.title) {
          await nodeService.updateNodeTitle(numericNodeId, update.data.title);
        }
        
        if (update.data.description) {
          await nodeService.updateNodeDescription(numericNodeId, update.data.description);
        }
      }
      
      // Update state
      setNodes(currentNodes => 
        currentNodes.map(node => {
          const update = updates.find(u => u.id === node.id);
          if (update) {
            return {
              ...node,
              data: {
                ...node.data,
                ...update.data,
                label: update.data.title || node.data.label
              }
            };
          }
          return node;
        })
      );
      
      // Update chat nodes record
      setChatNodes(current => {
        const updated = { ...current };
        for (const update of updates) {
          if (updated[update.id]) {
            updated[update.id] = {
              ...updated[update.id],
              ...update.data
            };
          }
        }
        return updated;
      });
      
      // Sync to Yjs if enabled
      if (enableYjs && yjs && yjs.isConnected && yjs.ydoc) {
        // Batch sync to Yjs would happen here
      }
      
      return true;
    } catch (err) {
      console.error('Error batch updating nodes:', err);
      return false;
    }
  }, [yjs, enableYjs]);

  /**
   * Refresh nodes from data source
   */
  const refreshNodes = useCallback(async (): Promise<void> => {
    return loadNodes();
  }, [loadNodes]);

  // Initial load
  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  // Subscribe to Yjs changes if enabled
  useEffect(() => {
    if (!enableYjs || !yjs || !yjs.ydoc) {
      return;
    }
    
    // Setup subscription to Yjs changes
    const cleanup = () => {
      // Cleanup function would remove listeners
    };
    
    return cleanup;
  }, [yjs, enableYjs]);

  return {
    nodes,
    loading,
    error,
    createNode,
    updateNode,
    deleteNode,
    getNodeById,
    batchUpdateNodes,
    refreshNodes,
    setNodes
  };
};

export default useCanvasNodes; 