/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeChange,
  NodeTypes,
  NodeMouseHandler,
  EdgeChange,
  NodeAddChange,
  NodePositionChange,
  updateEdge,
  OnEdgesChange,
  OnNodesChange,
  NodeDragHandler,
  OnMove,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../styles/reactflow.css';
import FloatingMenu from '../components/FloatingMenu';
import ChatNode from '../components/ChatNode';
import LibrarySidebar from '../components/LibrarySidebar';
import UserCursors from '../components/UserCursors';
import YjsNodeControls from '../components/YjsNodeControls';
import CollaborationStatus from '../components/CollaborationStatus';
import { Prompt } from '../services/promptService';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { 
  ChatNode as ChatNodeType,
  SupabasePayload,
  updateNodePosition,
  fetchNodes,
  createNode,
  deleteNode,
} from '../services/nodeService';
import { getContextPullsForNode, getNodesPullingFromNode } from '../services/contextPullService';
import { supabase } from '../services/supabase';
import { useCRDT } from '../legacy/CRDTContext';
import { useYjs } from '../contexts/YjsContext';
import { NodePositionOperation } from '../legacy/crdt';
import { generateLamportTimestamp } from '../legacy/vectorClock';
import { 
  syncNodeChangesToYjs, 
  syncEdgeChangesToYjs, 
  syncNodeDeletionToYjs,
  syncEdgeDeletionToYjs,
  setupYjsSubscription
} from '../utils/reactFlowYjsBinding';
import {
  ViewportBounds,
} from '../utils/yjsOptimization';
import { mapEdgeToYjs, mapNodeToYjs } from '../services/yjsService';
import { isYjsEnabled, getPositionAdapter } from '../services/positionAdapter';
import { debounce } from 'lodash';

const nodeTypes: NodeTypes = {
  chatNode: ChatNode,
};

const initialEdges: Edge[] = [];

// Use the centralized feature flag
const USE_YJS = isYjsEnabled();
// Get the appropriate position adapter based on the feature flag
const positionAdapter = getPositionAdapter();

interface CanvasPageProps {
  onNodeSelect: (nodeId: string | null, nodeTitle: string | null) => void;
  onOpenSettings?: () => void;
}

interface UserPresence {
  userId: string;
  email: string;
  isTyping: boolean;
  lastActive: string;
}

const CanvasPage: React.FC<CanvasPageProps> = ({ onNodeSelect, onOpenSettings }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [updatingPositionNodeId, setUpdatingPositionNodeId] = useState<string | null>(null);
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [conflictNodeId, setConflictNodeId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportBounds | null>(null);
  const optimizedPositionUpdater = useRef<((nodeId: string, position: { x: number; y: number }) => void) | null>(null);

  // Add CRDT context with the functions we need
  const { 
    addPendingOperation, 
    removePendingOperation,
    hasPendingOperations,
    updateNodeVectorClock,
    getNodeVectorClock
  } = useCRDT();
  
  // Add Yjs context - this will be undefined if Yjs is not enabled
  const yjs = USE_YJS ? useYjs() : undefined;

  // Add subscription tracking ref
  const yjsSubscriptionRef = useRef<(() => void) | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: Edge[]) => addEdge(params, eds)),
    [setEdges]
  );

  // Function to check if there are updates since last pull
  const checkForUpdates = useCallback(async (originNodeId: number, lastPulledAt: string) => {
    const { data: latestMessages } = await supabase
      .from('chat_messages')
      .select('timestamp')
      .eq('node_id', originNodeId)
      .gt('timestamp', lastPulledAt)
      .limit(1);
    
    return latestMessages && latestMessages.length > 0;
  }, []);

  // Function to load nodes with their connections
  const loadNodesWithConnections = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('Loading nodes with connections from database...');
      
      // If Yjs is enabled and connected, try to load nodes from Yjs document
      if (USE_YJS && yjs && yjs.isConnected && yjs.ydoc) {
        console.log('Loading nodes from Yjs document...');
        try {
          // Get nodes and edges from Yjs
          const yjsNodes = yjs.getNodesFromYjs();
          const yjsEdges = yjs.getEdgesFromYjs();
          
          if (yjsNodes.length > 0) {
            console.log('Loaded nodes from Yjs document:', yjsNodes);
            setNodes(yjsNodes);
            
            // If we have edges from Yjs, use those too
            if (yjsEdges.length > 0) {
              console.log('Loaded edges from Yjs document:', yjsEdges);
              setEdges(yjsEdges);
              return; // Successfully loaded from Yjs, no need to fetch from database
            }
          }
        } catch (error) {
          console.error('Error loading from Yjs, falling back to database:', error);
          // Fall back to database loading
        }
      }
      
      // Fallback to traditional database loading
      const chatNodes = await fetchNodes();
      console.log('Fetched nodes from database:', chatNodes);
      
      // Get existing positions to preserve client state when reloading
      const existingNodePositions = new Map<string, { x: number; y: number }>();
      setNodes((nds) => {
        nds.forEach(node => {
          existingNodePositions.set(node.id, node.position);
        });
        return nds;
      });
      
      const reactFlowNodes: Node[] = await Promise.all(
        chatNodes.map(async (chatNode: ChatNodeType) => {
          // Get nodes this node pulls from
          const pulledConnections = await getContextPullsForNode(chatNode.node_id);
          const pulledConnectionsWithUpdates = await Promise.all(
            pulledConnections.map(async (pull) => {
              // Check if there are updates since last pull
              const hasUpdates = await checkForUpdates(
                pull.origin_node_id, 
                pull.last_pulled_at
              );
              
              return { 
                nodeId: pull.origin_node_id.toString(), 
                hasUpdates,
                pullId: pull.id
              };
            })
          );
          
          // Get nodes that pull from this node
          const pulledByConnections = await getNodesPullingFromNode(chatNode.node_id);
          const pulledByConnectionsData = pulledByConnections.map((pull) => ({
            nodeId: pull.target_node_id.toString(),
            pullId: pull.id
          }));

          // Get current user presence for this node
          let userPresence: UserPresence[] = [];
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            
            if (token) {
              const response = await fetch(`http://localhost:3001/api/presence/${chatNode.node_id}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              
              if (response.ok) {
                userPresence = await response.json();
              }
            }
          } catch (error) {
            console.error('Error fetching user presence:', error);
          }

          // Get attachments for this node
          let nodeAttachments: { attachment_id: number; file_url: string; file_type: string }[] = [];
          try {
            const { data: attachmentsData, error: attachmentsError } = await supabase
              .from('chat_attachments')
              .select('*')
              .eq('node_id', chatNode.node_id);
            
            if (attachmentsError) {
              throw attachmentsError;
            }
            
            if (attachmentsData && attachmentsData.length > 0) {
              nodeAttachments = await Promise.all(attachmentsData.map(async (att) => {
                // Use existing URL if it's already saved
                if (att.file_url) {
                  return {
                    attachment_id: att.attachment_id,
                    file_url: att.file_url,
                    file_type: att.file_type
                  };
                }
                
                // Create a signed URL with 1 year expiry
                const { data: urlData } = await supabase.storage
                  .from('chat-attachments')
                  .createSignedUrl(att.file_path, 60 * 60 * 24 * 365);
                
                return {
                  attachment_id: att.attachment_id,
                  file_url: urlData?.signedUrl || '',
                  file_type: att.file_type
                };
              }));
            }
          } catch (error) {
            console.error('Error fetching attachments:', error);
          }
          
          // Determine the node position (from React Flow state, database, or default)
          const nodeId = chatNode.node_id.toString();
          let position = { x: 0, y: 0 };
          
          if (existingNodePositions.has(nodeId)) {
            // Use existing position from React Flow state
            position = existingNodePositions.get(nodeId)!;
            console.log(`Using existing position for node ${nodeId}: x=${position.x}, y=${position.y}`);
          } else if (chatNode.position_x !== null && chatNode.position_y !== null && 
                     typeof chatNode.position_x === 'number' && typeof chatNode.position_y === 'number') {
            // Use position from database
            position = {
              x: chatNode.position_x,
              y: chatNode.position_y
            };
            console.log(`Using database position for node ${nodeId}: x=${position.x}, y=${position.y}`);
          } else {
            // Default position
            position = { x: 100, y: 100 };
            console.log(`Using default position for node ${nodeId}: x=100, y=100`);
            
            // Update the position in the database as well
            try {
              await updateNodePosition(chatNode.node_id, position);
              console.log(`Updated default position for node ${nodeId} in database`);
            } catch (error) {
              console.error(`Error updating default position for node ${nodeId}:`, error);
            }
          }
          
          return {
            id: nodeId,
            type: 'chatNode',
            position: position,
            data: {
              label: chatNode.title,
              nodeId: chatNode.node_id,
              model: chatNode.model,
              flavor: chatNode.flavor,
              users: userPresence,
              pulledConnections: pulledConnectionsWithUpdates,
              pulledByConnections: pulledByConnectionsData,
              attachments: nodeAttachments,
            },
          };
        })
      );
      setNodes(reactFlowNodes);

      // Create edges based on context pulls
      const { data: contextPulls, error } = await supabase
        .from('context_pulls')
        .select('target_node_id, origin_node_id');
      
      if (error) throw error;
      
      const newEdges: Edge[] = (contextPulls || []).map((pull) => ({
        id: `edge-${pull.origin_node_id}-${pull.target_node_id}`,
        source: pull.origin_node_id.toString(),
        target: pull.target_node_id.toString(),
        type: 'straight',
        animated: true,
        arrowHeadType: 'arrowclosed',
        style: { 
          strokeWidth: 2, 
          stroke: '#555', 
          strokeDasharray: '5, 5' 
        },
      }));
      
      setEdges(newEdges);
    } catch (error) {
      console.error('Error loading nodes with connections:', error);
    }
  }, [user, yjs, setNodes, setEdges, checkForUpdates]);

  // Load nodes on mount and set up socket listeners
  useEffect(() => {
    if (!user) return;
    
    loadNodesWithConnections();
    
    // Set up Socket.IO event listeners
    if (socket) {
      socket.on('node-update', (payload: SupabasePayload<ChatNodeType>) => {
        console.log('Socket: Node update received:', payload);
        
        if (payload.eventType === 'INSERT' && payload.new) {
          // Add the new node if it doesn't already exist
          setNodes((nds) => {
            if (nds.some((node) => node.id === payload.new?.node_id.toString())) {
              return nds;
            }
            
            // Ensure payload.new is defined
            if (!payload.new) return nds;
            
            // Use stored positions or default to random if not available
            const position = {
              x: payload.new.position_x ?? 0,
              y: payload.new.position_y ?? 0
            };
            
            console.log(`Node insert event: Using position from database for node ${payload.new.node_id}: x=${position.x}, y=${position.y}`);
            
            const newNode: Node = {
              id: payload.new.node_id.toString(),
              type: 'chatNode',
              position: position,
              data: {
                label: payload.new.title,
                nodeId: payload.new.node_id,
                model: payload.new.model,
                flavor: payload.new.flavor,
                users: [],
                pulledConnections: [],
                pulledByConnections: [],
                attachments: [],
              },
            };
            return [...nds, newNode];
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          // Remove the deleted node
          setNodes((nds) => nds.filter((node) => node.id !== payload.old!.node_id.toString()));
          if (selectedNodeId === payload.old.node_id.toString()) {
            onNodeSelect(null, null);
            setSelectedNodeId(null);
          }
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          // Update node with new data including position
          setNodes((nds) => nds.map(node => {
            if (node.id === payload.new!.node_id.toString()) {
              // Update the node with new data
              const position = {
                x: payload.new!.position_x ?? 0,
                y: payload.new!.position_y ?? 0
              };
              
              console.log(`Node update event: Using position from database for node ${payload.new!.node_id}: x=${position.x}, y=${position.y}`);
              
              return {
                ...node,
                position: position,
                data: {
                  ...node.data,
                  label: payload.new!.title,
                  model: payload.new!.model,
                  flavor: payload.new!.flavor
                }
              };
            }
            return node;
          }));
        } else {
          // For other events, reload all nodes
          loadNodesWithConnections();
        }
      });
      
      socket.on('presence-update', (payload) => {
        console.log('Socket: Presence update received:', payload);
        // Update the specific node with new presence data
        setNodes((nds) => 
          nds.map((node) => 
            node.id === payload.nodeId.toString() 
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  users: payload.presence
                } 
              } 
            : node
          )
        );
      });
      
      socket.on('node-state-update', async (payload) => {
        console.log('Socket: Node state update received:', payload);
        console.log('Current nodes:', nodes.map(n => n.id));
        console.log('Looking for node:', payload.nodeId);
        
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === payload.nodeId) {
              console.log('Updating node state for node:', node.id);
              return {
                ...node,
                data: {
                  ...node.data,
                  pulledConnections: payload.pulledConnections,
                  pulledByConnections: payload.pulledByConnections,
                  attachments: payload.attachments,
                },
              };
            }
            return node;
          })
        );
        
        setEdges((eds) => {
          const newEdges = payload.pulledConnections.map((conn: { nodeId: string }) => ({
            id: `edge-${conn.nodeId}-${payload.nodeId}`,
            source: conn.nodeId,
            target: payload.nodeId,
            type: 'straight',
            animated: true,
            arrowHeadType: 'arrowclosed',
            style: { strokeWidth: 2, stroke: '#555', strokeDasharray: '5, 5' },
          }));
          return [...eds.filter((e) => e.target !== payload.nodeId), ...newEdges];
        });
      });
      
      socket.on('node-position-update', ({ nodeId, position, vectorClock, lamportTimestamp, applied }) => {
        console.log('Socket: Node position update received:', nodeId, position, vectorClock);
        
        // Skip the update if we're still in the same cycle to avoid feedback loops
        if (updatingPositionNodeId === nodeId) {
          console.log('Ignoring position update for node we just updated locally');
          return;
        }
        
        // Update the node's vector clock
        if (vectorClock) {
          updateNodeVectorClock(nodeId, vectorClock);
        }
        
        // For operations that were optimistically applied locally, remove from pending
        if (hasPendingOperations(nodeId) && lamportTimestamp) {
          // Remove this operation from pending operations if it matches
          removePendingOperation(nodeId, lamportTimestamp);
        }
        
        // Only update the position if the server applied the change
        // Or if it's not our own optimistic update
        if (applied !== false) {
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === nodeId) {
                console.log(`Updating position of node ${nodeId} from socket event: x=${position.x}, y=${position.y}`);
                return {
                  ...node,
                  position: {
                    x: position.x,
                    y: position.y
                  },
                };
              }
              return node;
            })
          );
        }
      });
      
      // Return cleanup function
      return () => {
        socket.off('node-update');
        socket.off('presence-update');
        socket.off('node-state-update');
        socket.off('node-position-update');
      };
    } else {
      // Fallback to Supabase real-time if Socket.IO is not available
      console.log('Socket.IO not available, using Supabase Realtime as fallback');
      
      try {
        const channel = supabase.channel('real-time-updates', {
          config: {
            broadcast: { self: true },
            presence: { key: user.id },
          },
        });
        
        // Subscribe to changes in context_pulls table
        channel
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'context_pulls',
            },
            () => {
              console.log('Supabase: Context pull change detected');
              loadNodesWithConnections();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages',
            },
            () => {
              console.log('Supabase: New message detected');
              loadNodesWithConnections();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'chat_nodes'
            },
            (payload) => {
              console.log('Supabase: Node update detected', payload);
              if (payload.new && typeof payload.new.node_id === 'number') {
                // Skip the update if we're still in the same cycle 
                // to avoid a feedback loop between local changes and database events
                if (updatingPositionNodeId === payload.new.node_id.toString()) {
                  console.log('Ignoring update from Supabase for node we just updated locally');
                  return;
                }
                
                // Check if this is a position update
                if (payload.old && 
                    (payload.old.position_x !== payload.new.position_x || 
                     payload.old.position_y !== payload.new.position_y)) {
                  console.log('Supabase: Position change detected');
                  setNodes((nds) =>
                    nds.map((node) => {
                      if (node.id === payload.new.node_id.toString()) {
                        const position = {
                          x: payload.new.position_x ?? 0,
                          y: payload.new.position_y ?? 0
                        };
                        console.log(`Supabase realtime: Updating position for node ${payload.new.node_id}: x=${position.x}, y=${position.y}`);
                        return {
                          ...node,
                          position
                        };
                      }
                      return node;
                    })
                  );
                } else {
                  // Handle other types of updates
                  setNodes((nds) =>
                    nds.map((node) => {
                      if (node.id === payload.new.node_id.toString()) {
                        return {
                          ...node,
                          data: {
                            ...node.data,
                            label: payload.new.title,
                            model: payload.new.model,
                            flavor: payload.new.flavor
                          }
                        };
                      }
                      return node;
                    })
                  );
                }
              }
            }
          )
          .subscribe((status) => {
            console.log(`Supabase channel status: ${status}`);
            if (status === 'SUBSCRIBED') {
              console.log('Successfully subscribed to Supabase Realtime channels');
            }
            if (status === 'CHANNEL_ERROR') {
              console.error('Error connecting to Supabase Realtime. Retrying in 5 seconds...');
              // Attempt to reconnect after a delay
              setTimeout(() => {
                channel.subscribe();
              }, 5000);
            }
          });

        return () => {
          channel.unsubscribe();
        };
      } catch (error) {
        console.error('Error setting up Supabase Realtime:', error);
        
        // Fallback to polling as a last resort
        const pollingInterval = setInterval(() => {
          console.log('Polling for updates...');
          loadNodesWithConnections();
        }, 10000); // Poll every 10 seconds
        
        return () => {
          clearInterval(pollingInterval);
        };
      }
    }
  }, [user, loadNodesWithConnections, socket, selectedNodeId, onNodeSelect, updatingPositionNodeId]);

  // Handle node selection/deselection
  useEffect(() => {
    if (!socket || !user) return;

    // If a node was previously selected and is different from the current selection,
    // emit leave-node event for the previous node
    if (selectedNodeId && selectedNodeId !== null) {
      // When component unmounts or selectedNodeId changes, leave the previous node
      return () => {
        socket.emit('leave-node', { nodeId: parseInt(selectedNodeId) });
      };
    }
  }, [socket, selectedNodeId, user]);

  // Update node positions function - throttled to avoid excessive updates
  const updateNodePosition = useCallback(
    debounce((nodeId: string, position: { x: number; y: number }) => {
      console.log(`Updating position for node ${nodeId}: x=${position.x}, y=${position.y}`);
      
      setUpdatingPositionNodeId(nodeId);
      
      // Use the position adapter for all position updates
      positionAdapter.updateNodePosition(nodeId, position.x, position.y)
        .then((success) => {
          if (success) {
            console.log('Position updated successfully via adapter');
          } else {
            console.error('Failed to update position via adapter');
          }
        })
        .catch((error) => {
          console.error('Error updating position via adapter:', error);
        })
        .finally(() => {
          setUpdatingPositionNodeId(null);
        });
    }, 50),
    [positionAdapter]
  );

  // Initialize optimized position updater
  useEffect(() => {
    if (USE_YJS && yjs && yjs.ydoc) {
      import('../utils/yjsOptimization').then(({ createOptimizedPositionUpdater }) => {
        optimizedPositionUpdater.current = createOptimizedPositionUpdater(yjs.ydoc);
      });
    }
    
    return () => {
      // Clean up optimizer
      import('../utils/yjsOptimization').then(({ cleanupOptimization }) => {
        cleanupOptimization();
      });
    };
  }, [yjs, USE_YJS]);

  // Handle viewport changes for selective loading
  const onViewportChange: OnMove = useCallback((_, viewport) => {
    if (!USE_YJS || !yjs || !yjs.ydoc) return;
    
    // Calculate viewport bounds based on ReactFlow's viewport
    const viewportBounds: ViewportBounds = {
      minX: viewport.x,
      maxX: viewport.x + window.innerWidth / viewport.zoom,
      minY: viewport.y,
      maxY: viewport.y + window.innerHeight / viewport.zoom,
      padding: 1000 // Extra padding around viewport in pixels
    };
    
    setViewport(viewportBounds);
    
    // Update visible area and load necessary chunks
    import('../utils/yjsOptimization').then(({ updateViewport, selectivelyLoadNodes }) => {
      // Get chunks that need to be loaded
      const chunksToLoad = updateViewport(viewportBounds);
      
      if (chunksToLoad.length > 0) {
        console.log(`Loading ${chunksToLoad.length} new chunks into view`);
        
        // Selectively load nodes in viewport
        if (yjs && yjs.ydoc) {
          const { nodes: visibleNodes, edges: visibleEdges } = selectivelyLoadNodes(yjs.ydoc, viewportBounds);
          
          // Update the nodes that are not already loaded
          setNodes(currentNodes => {
            const existingNodeIds = new Set(currentNodes.map(node => node.id));
            const newNodes = visibleNodes.filter(node => !existingNodeIds.has(node.id));
            
            // Only update if we have new nodes to add
            if (newNodes.length > 0) {
              console.log(`Adding ${newNodes.length} new nodes to view`);
              return [...currentNodes, ...newNodes];
            }
            return currentNodes;
          });
          
          // Update the edges
          setEdges(currentEdges => {
            const existingEdgeIds = new Set(currentEdges.map(edge => edge.id));
            const newEdges = visibleEdges.filter(edge => !existingEdgeIds.has(edge.id));
            
            // Only update if we have new edges to add
            if (newEdges.length > 0) {
              console.log(`Adding ${newEdges.length} new edges to view`);
              return [...currentEdges, ...newEdges];
            }
            return currentEdges;
          });
        }
      }
    });
  }, [yjs, USE_YJS]);

  // Enhanced onNodesChange handler with Yjs integration
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply custom position changes
      if (USE_YJS && yjs && yjs.ydoc) {
        // Use ReactFlow-Yjs binding to sync node changes to Yjs
        setNodes((nodes) => syncNodeChangesToYjs(changes, nodes, yjs.ydoc));
        
        // Handle node removals separately
        changes.forEach(change => {
          if (change.type === 'remove') {
            syncNodeDeletionToYjs(change.id, yjs.ydoc);
          }
        });
      } else {
        // Use default ReactFlow behavior if Yjs is not enabled
        onNodesChange(changes);
        
        // Handle position changes with original CRDT system
        changes.forEach(change => {
          if (change.type === 'position' && change.position) {
            updateNodePosition(change.id, change.position);
          }
        });
      }
    },
    [onNodesChange, yjs, updateNodePosition]
  );

  // Enhanced onEdgesChange handler with Yjs integration
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (USE_YJS && yjs && yjs.ydoc) {
        // Use ReactFlow-Yjs binding to sync edge changes to Yjs
        setEdges((edges) => syncEdgeChangesToYjs(changes, edges, yjs.ydoc));
        
        // Handle edge removals separately
        changes.forEach(change => {
          if (change.type === 'remove') {
            syncEdgeDeletionToYjs(change.id, yjs.ydoc);
          }
        });
      } else {
        // Use default ReactFlow behavior if Yjs is not enabled
        onEdgesChange(changes);
      }
    },
    [onEdgesChange, yjs]
  );

  // Enhanced onConnect handler with Yjs integration
  const handleConnect = useCallback(
    (params: Connection) => {
      const newEdge = { ...params, id: `e-${params.source}-${params.target}` };
      
      if (USE_YJS && yjs && yjs.ydoc) {
        // Add edge to ReactFlow state
        setEdges((eds) => {
          const updatedEdges = addEdge(newEdge, eds);
          
          // Map the new edge to Yjs
          const addedEdge = updatedEdges.find(e => e.id === newEdge.id);
          if (addedEdge) {
            // Use the mapEdgeToYjs function from yjsService
            mapEdgeToYjs(addedEdge);
          }
          
          return updatedEdges;
        });
      } else {
        // Use default behavior
        setEdges((eds) => addEdge(params, eds));
      }
    },
    [setEdges, yjs]
  );
  
  // Set up Yjs subscription when ydoc changes
  useEffect(() => {
    // Clean up previous subscription if it exists
    if (yjsSubscriptionRef.current) {
      yjsSubscriptionRef.current();
      yjsSubscriptionRef.current = null;
    }
    
    // Set up new subscription if Yjs is enabled and ydoc exists
    if (USE_YJS && yjs && yjs.ydoc && yjs.isConnected) {
      yjsSubscriptionRef.current = setupYjsSubscription(
        yjs.ydoc,
        setNodes,
        setEdges
      );
      
      // Log that we've set up the subscription
      console.log('Yjs subscription for ReactFlow established');
    }
    
    // Clean up subscription on component unmount
    return () => {
      if (yjsSubscriptionRef.current) {
        yjsSubscriptionRef.current();
        yjsSubscriptionRef.current = null;
      }
    };
  }, [yjs?.ydoc, yjs?.isConnected, setNodes, setEdges]);

  // Handle prompt drag from LibrarySidebar
  const handlePromptDrag = useCallback((prompt: Prompt) => {
    console.log('Prompt dragged:', prompt);
    // Implement your prompt drag handling logic here
  }, []);
  
  // Handle node creation
  const onCreateNode = useCallback((title: string, modelName: string, flavorName: string) => {
    console.log('Creating node:', { title, modelName, flavorName });
    // Implement your node creation logic here
  }, []);
  
  // Handle node click
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    onNodeSelect(node.id, node.data.label as string);
  }, [onNodeSelect]);

  // Add a console log to check if this component is rendering
  console.log('CanvasPage rendering, will include LibrarySidebar');

  // Function to handle node drag end and position updates
  const onNodeDragStop: NodeMouseHandler = useCallback((event, node) => {
    if (!user) return;
    
    const nodeId = node.id;
    console.log(`Node drag stopped for node ${nodeId} at position: x=${node.position.x}, y=${node.position.y}`);
    
    try {
      // If Yjs is enabled, update the position in the Yjs document
      if (USE_YJS && yjs && yjs.ydoc) {
        // Use optimized position updater if available
        if (optimizedPositionUpdater.current) {
          optimizedPositionUpdater.current(nodeId, node.position);
        } else {
          // Fallback to regular update
          import('../services/yjsService').then(({ updateNodePositionYjs }) => {
            updateNodePositionYjs(nodeId, node.position);
          });
        }
      } else {
        // Legacy CRDT approach
        const numericNodeId = parseInt(nodeId);
        setUpdatingPositionNodeId(nodeId);
        
        // Generate vector clock for the node
        const vectorClock = getNodeVectorClock(nodeId);
        const lamportTimestamp = generateLamportTimestamp();
        
        // Create position update operation - match the expected type structure
        const operation: NodePositionOperation = {
          nodeId,
          position: node.position,
          vectorClock: { ...vectorClock, [user.id]: (vectorClock[user.id] || 0) + 1 },
          lamportTimestamp,
          userId: user.id
        };
        
        console.log('Position update operation:', operation);
        addPendingOperation(operation);
        
        // Update position in database - using appropriate types
        updateNodePosition(numericNodeId, node.position, user.id, vectorClock).then((result) => {
          console.log(`Position updated in database for node ${nodeId}`);
          setUpdatingPositionNodeId(null);
          removePendingOperation(nodeId, lamportTimestamp);
        }).catch(error => {
          console.error(`Error updating position for node ${nodeId}:`, error);
          setUpdatingPositionNodeId(null);
        });
      }
    } catch (error) {
      console.error(`Error handling node drag for ${nodeId}:`, error);
    }
  }, [user, yjs, optimizedPositionUpdater, addPendingOperation, getNodeVectorClock, removePendingOperation]);

  // Handle socket events for position updates
  useEffect(() => {
    if (!socket || USE_YJS) return; // Don't use socket for position updates if Yjs is enabled
    
    // Listen for node position updates
    socket.on('node-position-update', (data: any) => {
      // ... existing socket event handling ...
    });
    
    return () => {
      socket.off('node-position-update');
    };
  }, [socket, updateNodeVectorClock, setNodes]);

  // Set up Yjs awareness for cursor tracking
  useEffect(() => {
    if (!USE_YJS || !yjs || !yjs.ydoc) return;
    
    const handleMouseMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      // Get canvas container element
      const canvasContainer = document.querySelector('.react-flow');
      if (!canvasContainer) return;
      
      // Convert global mouse position to canvas coordinates
      const rect = canvasContainer.getBoundingClientRect();
      const x = mouseEvent.clientX - rect.left;
      const y = mouseEvent.clientY - rect.top;
      
      // Update awareness with cursor position
      yjs.updateAwareness({
        cursor: { x, y }
      });
    };
    
    // Add mousemove event listener to canvas container
    const canvasContainer = document.querySelector('.react-flow');
    if (canvasContainer) {
      canvasContainer.addEventListener('mousemove', handleMouseMove);
    }
    
    return () => {
      if (canvasContainer) {
        canvasContainer.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [yjs]);

  // Function to handle cursor movement for Yjs awareness
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    // Only track if Yjs is enabled
    if (USE_YJS && yjs && yjs.isConnected) {
      const container = document.querySelector('.react-flow__pane');
      if (container) {
        const rect = container.getBoundingClientRect();
        // Calculate cursor position relative to the container
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Update user awareness with cursor position
        yjs.updateAwareness({ cursor: { x, y } });
      }
    }
  }, [yjs]);
  
  // Subscribe to Yjs document for conflict detection (simplified example)
  useEffect(() => {
    if (USE_YJS && yjs && yjs.ydoc) {
      // This is a simplified example of conflict detection
      // In a real implementation, this would be more sophisticated
      const checkForConflicts = () => {
        // Just displaying the conflict modal if a specific condition is met
        // This is for demonstration purposes only
        // Real implementation would check for actual conflicts in the Yjs document
        
        // For this example, we'll just simulate a conflict in a random scenario
        // This would be replaced with actual conflict detection logic
        const simulateConflict = Math.random() > 0.95; // 5% chance of conflict for demo
        
        if (simulateConflict && nodes.length > 0) {
          // Pick a random node to simulate conflict
          const randomIndex = Math.floor(Math.random() * nodes.length);
          const randomNodeId = nodes[randomIndex].id;
          
          // Show conflict modal for that node
          setConflictNodeId(randomNodeId);
          setShowConflictModal(true);
        }
      };
      
      // Check for conflicts periodically (for demonstration only)
      // In a real implementation, this would be event-based
      const intervalId = setInterval(checkForConflicts, 120000); // Check every 2 minutes
      
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [yjs, nodes]);
  
  // Handle conflict resolution
  const handleConflictResolution = useCallback((resolution: 'local' | 'remote') => {
    // Apply the chosen resolution
    console.log(`Applying ${resolution} version for node ${conflictNodeId}`);
    
    // In a real implementation, this would apply the chosen version
    // For now, we just close the modal
    setShowConflictModal(false);
    setConflictNodeId(null);
  }, [conflictNodeId]);

  // Handle canceling conflict resolution
  const handleCancelConflict = useCallback(() => {
    setShowConflictModal(false);
    setConflictNodeId(null);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', position: 'relative' }}>
      <LibrarySidebar onPromptDrag={handlePromptDrag} />
      <div 
        style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}
        onMouseMove={handleMouseMove}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          style={{ background: '#f8f8f8' }}
          onMove={onViewportChange}
        >
          <Controls />
          <MiniMap />
          <Background color="#aaa" gap={12} size={1} />
          
          {/* Add UserCursors component for Yjs user presence */}
          {USE_YJS && <UserCursors />}
        </ReactFlow>
        
        {/* Floating menu for creating nodes */}
        <FloatingMenu onCreateNode={onCreateNode} onOpenSettings={onOpenSettings} />
        
        {/* Add Yjs collaboration components when enabled */}
        {USE_YJS && (
          <>
            <div style={{ 
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              zIndex: 10
            }}>
              <CollaborationStatus />
            </div>
            
            <YjsNodeControls />
          </>
        )}
        
        {/* Simplified conflict modal (would use the actual component in real implementation) */}
        {showConflictModal && conflictNodeId && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              width: '500px',
              maxWidth: '90vw'
            }}>
              <h3>Conflict Detected</h3>
              <p>Changes to node {conflictNodeId} were made simultaneously. Choose which version to keep:</p>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button onClick={handleCancelConflict}>Cancel</button>
                <button onClick={() => handleConflictResolution('remote')}>Use Remote</button>
                <button onClick={() => handleConflictResolution('local')}>Use Mine</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasPage; 