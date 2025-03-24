import React, { useCallback, useEffect, useState } from 'react';
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
  NodeRemoveChange,
  NodeChange,
  NodeTypes,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import FloatingMenu from '../components/FloatingMenu';
import ChatNode from '../components/ChatNode';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ChatNode as ChatNodeType, SupabasePayload, createNode, fetchNodes, deleteNode, updateNodePosition } from '../services/nodeService';
import { getContextPullsForNode, getNodesPullingFromNode } from '../services/contextPullService';
import { supabase } from '../services/supabase';

const nodeTypes: NodeTypes = {
  chatNode: ChatNode,
};

const initialEdges: Edge[] = [];

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
      const chatNodes = await fetchNodes();
      
      // First get the existing node positions from local state to preserve them if needed
      const existingNodePositions = new Map<string, { x: number; y: number }>();
      setNodes((nds) => {
        nds.forEach(node => {
          existingNodePositions.set(node.id, node.position);
        });
        return nds;
      });
      
      const reactFlowNodes: Node[] = await Promise.all(
        chatNodes.map(async (chatNode) => {
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
            // Get the current session token
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

          // Determine node position with the following priority:
          // 1. Use existing position from current React Flow state if available
          // 2. Use position from database
          // 3. Default to (0,0) if neither is available
          const nodeId = chatNode.node_id.toString();
          let position: { x: number; y: number };
          
          if (existingNodePositions.has(nodeId)) {
            // Use existing position from React Flow state
            position = existingNodePositions.get(nodeId)!;
            console.log(`Using existing position for node ${nodeId}: x=${position.x}, y=${position.y}`);
          } else if (chatNode.position_x !== null && chatNode.position_y !== null) {
            // Use position from database
            position = {
              x: chatNode.position_x ?? 0,
              y: chatNode.position_y ?? 0
            };
            console.log(`Using database position for node ${nodeId}: x=${position.x}, y=${position.y}`);
          } else {
            // Default position
            position = { x: 0, y: 0 };
            console.log(`Using default position for node ${nodeId}: x=0, y=0`);
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
              attachments: [],
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
  }, [user, setNodes, checkForUpdates, setEdges]);

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
              x: payload.new.position_x ?? 0, // Default to 0 if undefined
              y: payload.new.position_y ?? 0  // Default to 0 if undefined
            };
            
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
                x: payload.new!.position_x ?? 0, // Default to 0 if undefined
                y: payload.new!.position_y ?? 0  // Default to 0 if undefined
              };
              
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
      
      socket.on('node-position-update', ({ nodeId, position }) => {
        console.log('Socket: Node position update received:', nodeId, position);
        
        // Skip the update if we're still in the same cycle 
        // to avoid a feedback loop between local changes and socket events
        if (updatingPositionNodeId === nodeId) {
          console.log('Ignoring position update for node we just updated locally');
          return;
        }
        
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === nodeId) {
              console.log(`Updating position of node ${nodeId} from socket event`);
              return {
                ...node,
                position: position,
              };
            }
            return node;
          })
        );
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
              table: 'chat_nodes',
              filter: `position_x=neq.position_x`,
            },
            (payload) => {
              console.log('Supabase: Node position change detected', payload);
              if (payload.new && typeof payload.new.node_id === 'number') {
                setNodes((nds) =>
                  nds.map((node) => {
                    if (node.id === payload.new.node_id.toString()) {
                      const position = {
                        x: payload.new.position_x ?? 0,
                        y: payload.new.position_y ?? 0
                      };
                      return {
                        ...node,
                        position
                      };
                    }
                    return node;
                  })
                );
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

  const onCreateNode = useCallback(async (title: string, modelName: string, flavorName: string) => {
    if (!user) return;
    try {
      const newChatNode = await createNode(user.id, title, modelName, flavorName);
      const newNode: Node = {
        id: newChatNode.node_id.toString(),
        type: 'chatNode',
        position: { x: newChatNode.position_x ?? 0, y: newChatNode.position_y ?? 0 },
        data: {
          label: newChatNode.title,
          nodeId: newChatNode.node_id,
          model: newChatNode.model,
          flavor: newChatNode.flavor,
          users: [],
          pulledConnections: [],
          pulledByConnections: [],
          attachments: [],
        },
      };
      setNodes((nds: Node[]) => [...nds, newNode]);
    } catch (error) {
      console.error('Error creating node:', error);
    }
  }, [user, setNodes]);

  const onNodesDelete = useCallback(
    async (changes: NodeRemoveChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          try {
            await deleteNode(parseInt(change.id));
            // Deselect if the deleted node was selected
            onNodeSelect(null, null);
            setSelectedNodeId(null);
          } catch (error) {
            console.error('Error deleting node:', error);
          }
        }
      }
    },
    [onNodeSelect]
  );

  const handleNodesChange = useCallback(
    async (changes: NodeChange[]) => {
      onNodesChange(changes); // Apply changes to local state

      // Process position updates
      for (const change of changes) {
        if (
          change.type === 'position' &&
          change.position &&
          !change.dragging // Only save when dragging ends
        ) {
          const nodeId = parseInt(change.id);
          const { x, y } = change.position;
          
          try {
            console.log(`Updating position for node ${nodeId}: x=${x}, y=${y}`);
            
            // First update the position in our local state to ensure consistency
            setNodes((nds) =>
              nds.map((node) =>
                node.id === change.id
                  ? {
                      ...node,
                      position: { x, y },
                    }
                  : node
              )
            );
            
            // Set the updating node ID to avoid feedback loops
            setUpdatingPositionNodeId(change.id);
            
            // Send update to the database
            await updateNodePosition(nodeId, { x, y });
            console.log(`Successfully saved position for node ${nodeId}: x=${x}, y=${y}`);
            
            // Emit position update via Socket.IO for real-time collaboration
            if (socket) {
              socket.emit('node-position-update', {
                nodeId: change.id,
                position: change.position,
              });
            }
            
            // Clear the updating node ID after a short delay
            setTimeout(() => {
              setUpdatingPositionNodeId(null);
            }, 500);
          } catch (error) {
            console.error(`Failed to update position for node ${nodeId}:`, error);
          }
        }
      }

      // Handle node deletions
      const removeChanges = changes.filter(
        (change: NodeChange): change is NodeRemoveChange => change.type === 'remove'
      );
      if (removeChanges.length > 0) {
        onNodesDelete(removeChanges);
      }
    },
    [onNodesChange, onNodesDelete, setNodes, socket, setUpdatingPositionNodeId]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // If user is already in a node, first leave it
      if (selectedNodeId && socket) {
        socket.emit('leave-node', { nodeId: parseInt(selectedNodeId) });
      }
      
      // Set the new selected node
      setSelectedNodeId(node.id);
      onNodeSelect(node.id, node.data.label);
      
      // Join the new node
      if (socket) {
        socket.emit('join-node', { nodeId: parseInt(node.id) });
      }
    },
    [onNodeSelect, selectedNodeId, socket]
  );

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <FloatingMenu onCreateNode={onCreateNode} onOpenSettings={onOpenSettings} />
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export default CanvasPage; 