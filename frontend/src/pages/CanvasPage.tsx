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
import { ChatNode as ChatNodeType, SupabasePayload, createNode, fetchNodes, deleteNode } from '../services/nodeService';
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
          
          return {
            id: chatNode.node_id.toString(),
            type: 'chatNode',
            position: { x: Math.random() * 500, y: Math.random() * 500 },
            data: {
              label: chatNode.title,
              nodeId: chatNode.node_id,
              model: chatNode.model,
              flavor: chatNode.flavor,
              users: userPresence, // User presence data
              pulledConnections: pulledConnectionsWithUpdates,
              pulledByConnections: pulledByConnectionsData,
              attachments: [], // Placeholder for attachments (Phase 6)
            },
          };
        })
      );
      setNodes(reactFlowNodes);
    } catch (error) {
      console.error('Error loading nodes with connections:', error);
    }
  }, [user, setNodes, checkForUpdates]);

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
            
            const newNode: Node = {
              id: payload.new.node_id.toString(),
              type: 'chatNode',
              position: { x: Math.random() * 500, y: Math.random() * 500 },
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
      
      socket.on('node-state-update', (payload) => {
        console.log('Socket: Node state update received:', payload);
        setNodes((nds) =>
          nds.map((node) =>
            node.id === payload.nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    pulledConnections: payload.pulledConnections,
                    pulledByConnections: payload.pulledByConnections,
                    attachments: payload.attachments,
                  },
                }
              : node
          )
        );
      });
      
      // Return cleanup function
      return () => {
        socket.off('node-update');
        socket.off('presence-update');
        socket.off('node-state-update');
      };
    } else {
      // Fallback to Supabase real-time if Socket.IO is not available
      const channel = supabase.channel('real-time-updates');
      
      // Subscribe to changes in context_pulls table
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'context_pulls',
        },
        () => {
          loadNodesWithConnections();
        }
      );
      
      // Subscribe to changes in chat_messages table (for update detection)
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          loadNodesWithConnections();
        }
      );
      
      channel.subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, loadNodesWithConnections, socket, selectedNodeId, onNodeSelect]);

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
        position: { x: Math.random() * 500, y: Math.random() * 500 },
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
        onNodesChange={(changes: NodeChange[]) => {
          onNodesChange(changes);
          const removeChanges = changes.filter(
            (change: NodeChange): change is NodeRemoveChange => change.type === 'remove'
          );
          if (removeChanges.length > 0) {
            onNodesDelete(removeChanges);
          }
        }}
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