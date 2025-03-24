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
import '../styles/reactflow.css';
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
      console.log('Loading nodes with connections from database...');
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

  const onCreateNode = useCallback(async (title: string, modelName: string, flavorName: string) => {
    if (!user) return;
    try {
      // Create node in database
      const newChatNode = await createNode(user.id, title, modelName, flavorName);
      
      // Ensure position values are valid numbers
      const position = { 
        x: typeof newChatNode.position_x === 'number' ? newChatNode.position_x : 0, 
        y: typeof newChatNode.position_y === 'number' ? newChatNode.position_y : 0 
      };
      
      console.log('Created new node with position from database:', { 
        nodeId: newChatNode.node_id, 
        x: position.x, 
        y: position.y
      });
      
      // Create the React Flow node with position
      const newNode: Node = {
        id: newChatNode.node_id.toString(),
        type: 'chatNode',
        position: position,
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
      
      // Update nodes in local state
      setNodes((nds: Node[]) => [...nds, newNode]);
      
      // Ensure position is correctly registered in the database by explicitly saving it again
      // This helps prevent any issues with the initial save
      await updateNodePosition(newChatNode.node_id, position);
      console.log(`Verified position for new node ${newChatNode.node_id}: x=${position.x}, y=${position.y}`);
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
      // Apply changes to local state
      onNodesChange(changes);

      // Find position changes where dragging has just ended (dragging is false)
      const dragEndChanges = changes.filter(
        (change): change is NodeChange & { type: 'position'; position: { x: number; y: number }; dragging: boolean } => 
          change.type === 'position' && 
          change.position !== undefined &&
          change.dragging === false
      );

      // When a drag ends, immediately save the position to database
      for (const change of dragEndChanges) {
        const nodeId = parseInt(change.id);
        const { x, y } = change.position;
        
        try {
          console.log(`Drag ended for node ${nodeId} - Saving position: x=${x}, y=${y}`);
          
          // Set the updating node ID to avoid feedback loops
          setUpdatingPositionNodeId(change.id);
          
          // Save position to database
          await updateNodePosition(nodeId, { x, y });
          console.log(`Position saved for node ${nodeId}`);
          
          // Emit position update for real-time collaboration
          if (socket) {
            socket.emit('node-position-update', {
              nodeId: change.id,
              position: { x, y },
            });
          }
          
          // Clear the updating node ID after a short delay
          setTimeout(() => {
            setUpdatingPositionNodeId(null);
          }, 200);
        } catch (error) {
          console.error(`Error saving position for node ${nodeId}:`, error);
          setUpdatingPositionNodeId(null);
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

  // Save all node positions to the database
  const saveAllNodePositions = useCallback(async () => {
    console.log('Saving all node positions to database...');
    const currentNodes = [...nodes];
    
    // Use Promise.all to parallelize the updates
    await Promise.all(
      currentNodes.map(async (node) => {
        const nodeId = parseInt(node.id);
        if (!isNaN(nodeId)) {
          try {
            await updateNodePosition(nodeId, node.position);
            console.log(`Saved position for node ${nodeId}: x=${node.position.x}, y=${node.position.y}`);
          } catch (error) {
            console.error(`Failed to save position for node ${nodeId}:`, error);
          }
        }
      })
    );
  }, [nodes]);

  // Periodically save all node positions
  useEffect(() => {
    const interval = setInterval(() => {
      saveAllNodePositions();
    }, 30000); // Save all positions every 30 seconds
    
    return () => clearInterval(interval);
  }, [saveAllNodePositions]);

  // Save positions when component unmounts or beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveAllNodePositions();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      // Save positions when component unmounts
      saveAllNodePositions();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveAllNodePositions]);

  return (
    <div style={{ 
      height: '100%', 
      width: '100%',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        style={{ 
          width: '100%', 
          height: '100%',
          background: '#f5f5f6'
        }}
      >
        <FloatingMenu onCreateNode={onCreateNode} onOpenSettings={onOpenSettings} />
        <Background color="#aaa" gap={16} />
        <Controls 
          position="bottom-right"
          style={{
            bottom: 10,
            right: 10
          }}
        />
        <MiniMap
          nodeStrokeColor={(n) => {
            if (n.id === selectedNodeId) return '#ff0072';
            return '#555';
          }}
          nodeColor={(n) => {
            if (n.id === selectedNodeId) return '#ffcce6';
            return '#fff';
          }}
          style={{
            bottom: 10,
            left: 10,
            background: '#f5f5f6',
            border: '1px solid #ddd',
            borderRadius: '5px',
            height: 120,
            width: 160
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
};

export default CanvasPage; 