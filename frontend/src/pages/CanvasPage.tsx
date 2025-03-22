import React, { useCallback, useEffect } from 'react';
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
import { createNode, fetchNodes, deleteNode } from '../services/nodeService';
import { getContextPullsForNode, getNodesPullingFromNode } from '../services/contextPullService';
import { supabase } from '../services/supabase';

const nodeTypes: NodeTypes = {
  chatNode: ChatNode,
};

const initialEdges: Edge[] = [];

interface CanvasPageProps {
  onNodeSelect: (nodeId: string | null, nodeTitle: string | null) => void;
}

const CanvasPage: React.FC<CanvasPageProps> = ({ onNodeSelect }) => {
  const { user } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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
      const chatNodes = await fetchNodes(user.id);
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
          
          return {
            id: chatNode.node_id.toString(),
            type: 'chatNode',
            position: { x: Math.random() * 500, y: Math.random() * 500 },
            data: {
              label: chatNode.title,
              nodeId: chatNode.node_id,
              model: chatNode.model,
              flavor: chatNode.flavor,
              users: [], // Placeholder for user presence (Phase 5)
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

  // Load nodes on mount and set up subscriptions
  useEffect(() => {
    if (!user) return;
    
    loadNodesWithConnections();
    
    // Single channel for all subscriptions
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
  }, [user, loadNodesWithConnections]);

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
      onNodeSelect(node.id, node.data.label);
    },
    [onNodeSelect]
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
        <FloatingMenu onCreateNode={onCreateNode} />
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export default CanvasPage; 