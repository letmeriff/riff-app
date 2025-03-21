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
} from 'reactflow';
import 'reactflow/dist/style.css';
import FloatingMenu from '../components/FloatingMenu';
import { useAuth } from '../contexts/AuthContext';
import { createNode, fetchNodes, deleteNode } from '../services/nodeService';

const initialEdges: Edge[] = [];

const CanvasPage: React.FC = () => {
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
          type: 'default',
          position: { x: Math.random() * 500, y: Math.random() * 500 },
          data: { label: chatNode.title },
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
        type: 'default',
        position: { x: Math.random() * 500, y: Math.random() * 500 },
        data: { label: newChatNode.title },
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
          } catch (error) {
            console.error('Error deleting node:', error);
          }
        }
      }
    },
    []
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