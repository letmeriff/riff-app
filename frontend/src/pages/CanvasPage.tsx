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

  // Load nodes from Supabase on mount
  useEffect(() => {
    if (!user) return;
    const loadNodes = async () => {
      try {
        const chatNodes = await fetchNodes(user.id);
        const reactFlowNodes: Node[] = chatNodes.map((chatNode) => ({
          id: chatNode.node_id.toString(),
          type: 'chatNode',
          position: { x: Math.random() * 500, y: Math.random() * 500 },
          data: {
            label: chatNode.title,
            nodeId: chatNode.node_id,
            users: [], // Placeholder for user presence (Phase 5)
            pulledConnections: [], // Placeholder for connections (Phase 4)
            pulledByConnections: [], // Placeholder for connections (Phase 4)
            attachments: [], // Placeholder for attachments (Phase 6)
          },
        }));
        setNodes(reactFlowNodes);
      } catch (error) {
        console.error('Error loading nodes:', error);
      }
    };
    loadNodes();
  }, [user, setNodes]);

  const onCreateNode = useCallback(async () => {
    if (!user) return;
    try {
      const newChatNode = await createNode(user.id, `Node ${nodes.length + 1}`);
      const newNode: Node = {
        id: newChatNode.node_id.toString(),
        type: 'chatNode',
        position: { x: Math.random() * 500, y: Math.random() * 500 },
        data: {
          label: newChatNode.title,
          nodeId: newChatNode.node_id,
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
  }, [user, nodes.length, setNodes]);

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

  const simulateContentChange = () => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodes[0]?.id
          ? {
              ...node,
              data: {
                ...node.data,
                users: [
                  { id: '1', email: 'user1@example.com' },
                  { id: '2', email: 'user2@example.com' },
                ],
                pulledConnections: [
                  { nodeId: '2', hasUpdates: true },
                  { nodeId: '3', hasUpdates: false },
                ],
                pulledByConnections: [{ nodeId: '4' }],
                attachments: [{ file_url: 'test.pdf', file_type: 'pdf' }],
              },
            }
          : node
      )
    );
  };

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
        <button
          onClick={simulateContentChange}
          style={{
            position: 'absolute',
            top: '50px',
            left: '10px',
            zIndex: 1000,
            padding: '5px 10px',
          }}
        >
          Simulate Content Change
        </button>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export default CanvasPage; 