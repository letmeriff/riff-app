# Canvas Hook Interfaces

This document provides detailed documentation of the custom hooks used in the Canvas refactoring.

## useCanvasNodes

Manages node data and operations for the canvas.

### Interface

```typescript
interface UseCanvasNodesReturn {
  nodes: Node[];                                   // Current nodes
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>; // Setter for nodes
  loading: boolean;                                // Loading state
  error: Error | null;                             // Error state
  selectedNode: Node | null;                       // Currently selected node
  
  // Node Operations
  createNode: (position?: XYPosition) => Promise<Node>;
  updateNode: (nodeId: string, data: Partial<NodeData>) => void;
  updateNodeContent: (nodeId: string, content: string) => void;
  updateNodePosition: (nodeId: string, position: XYPosition) => void;
  deleteNode: (nodeId: string) => Promise<void>;
  
  // Selection Operations
  selectNode: (nodeId: string) => void;
  deselectNode: () => void;
  
  // ReactFlow Integration
  onNodesChange: OnNodesChange;                    // ReactFlow nodes change handler
}
```

### Example Usage

```typescript
const { 
  nodes, 
  createNode, 
  updateNodeContent, 
  deleteNode,
  onNodesChange,
  loading
} = useCanvasNodes();

// Create a new node
const handleAddNode = async () => {
  const newNode = await createNode({ x: 100, y: 100 });
  console.log('Created node:', newNode.id);
};

// Update node content
const handleContentChange = (nodeId: string, content: string) => {
  updateNodeContent(nodeId, content);
};

// Delete a node
const handleDeleteNode = async (nodeId: string) => {
  await deleteNode(nodeId);
};
```

## useCanvasEdges

Manages edge data and operations for the canvas.

### Interface

```typescript
interface UseCanvasEdgesReturn {
  edges: Edge[];                                   // Current edges
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>; // Setter for edges
  loading: boolean;                                // Loading state
  error: Error | null;                             // Error state
  
  // Edge Operations
  createEdge: (source: string, target: string, type?: string) => Edge;
  updateEdge: (edgeId: string, data: any) => void;
  deleteEdge: (edgeId: string) => void;
  getEdgesBetween: (source: string, target: string) => Edge[];
  
  // ReactFlow Integration
  onEdgesChange: OnEdgesChange;                    // ReactFlow edges change handler
  onConnect: OnConnect;                            // ReactFlow connection handler
}
```

### Example Usage

```typescript
const {
  edges,
  createEdge,
  deleteEdge,
  onEdgesChange,
  onConnect,
  loading
} = useCanvasEdges();

// Create a new edge
const handleCreateConnection = () => {
  const newEdge = createEdge('node1', 'node2');
  console.log('Created edge:', newEdge.id);
};

// Delete an edge
const handleDeleteEdge = (edgeId: string) => {
  deleteEdge(edgeId);
};
```

## useYjsIntegration

Manages real-time collaboration with Yjs.

### Interface

```typescript
interface UseYjsIntegrationReturn {
  // Connection State
  isConnected: boolean;                            // Connection status
  isOffline: boolean;                              // Offline mode status
  
  // Yjs Document
  ydoc: Y.Doc | null;                              // Yjs document
  nodesMap: Y.Map<any> | null;                     // Yjs map for nodes
  edgesMap: Y.Map<any> | null;                     // Yjs map for edges
  
  // Synchronization
  syncToYjs: (nodes: Node[], edges: Edge[]) => void;
  syncFromYjs: () => { nodes: Node[], edges: Edge[] };
  
  // Awareness
  awareness: Awareness | null;                     // Yjs awareness
  updateCursorPosition: (position: XYPosition) => void;
  getAwarenessStates: () => Record<number, any>[];
  
  // Offline Support
  pendingChanges: number;                          // Number of pending changes
  syncPendingChanges: () => Promise<void>;
}
```

### Example Usage

```typescript
const {
  isConnected,
  isOffline,
  syncToYjs,
  syncFromYjs,
  updateCursorPosition,
  pendingChanges
} = useYjsIntegration();

// Sync local changes to Yjs
const handleSyncChanges = () => {
  syncToYjs(nodes, edges);
};

// Update cursor position
const handleMouseMove = (e: React.MouseEvent) => {
  updateCursorPosition({ x: e.clientX, y: e.clientY });
};

// Display connection status
const connectionStatus = isConnected ? 'Connected' : 'Disconnected';
const offlineIndicator = isOffline ? `Offline (${pendingChanges} pending changes)` : '';
```

## useCanvasUI

Manages UI state for the canvas.

### Interface

```typescript
interface UseCanvasUIReturn {
  // Selection State
  selectedNodeId: string | null;                   // ID of selected node
  selectedNodeContent: string | null;              // Content of selected node
  
  // Viewport State
  viewport: {                                      // Viewport information
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    zoom: number;
  };
  
  // UI State Setters
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedNodeContent: (content: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  
  // UI Actions
  openNodeSettings: (nodeId: string) => void;
  closeNodeSettings: () => void;
  toggleToolbar: () => void;
  
  // UI State Getters
  isNodeSettingsOpen: boolean;
  isToolbarVisible: boolean;
}
```

### Example Usage

```typescript
const {
  selectedNodeId,
  selectedNodeContent,
  setSelectedNodeId,
  setSelectedNodeContent,
  viewport,
  setViewport,
  isNodeSettingsOpen,
  openNodeSettings
} = useCanvasUI();

// Handle node selection
const handleNodeClick = (event: React.MouseEvent, node: Node) => {
  setSelectedNodeId(node.id);
  setSelectedNodeContent(node.data.content);
};

// Handle viewport change
const handleViewportChange = (newViewport: ReactFlowViewport) => {
  setViewport({
    minX: -newViewport.x / newViewport.zoom,
    minY: -newViewport.y / newViewport.zoom,
    maxX: (-newViewport.x + window.innerWidth) / newViewport.zoom,
    maxY: (-newViewport.y + window.innerHeight) / newViewport.zoom,
    zoom: newViewport.zoom
  });
};

// Open node settings
const handleOpenSettings = () => {
  if (selectedNodeId) {
    openNodeSettings(selectedNodeId);
  }
};
```

## Advanced Hook Integration Examples

### Combining Hooks for Node Creation with Real-time Sync

```typescript
const { createNode } = useCanvasNodes();
const { syncToYjs } = useYjsIntegration();
const { setSelectedNodeId } = useCanvasUI();

const handleCreateAndSync = async (position: XYPosition) => {
  // Create the node locally
  const newNode = await createNode(position);
  
  // Sync to Yjs for real-time collaboration
  syncToYjs([newNode], []);
  
  // Update UI to select the new node
  setSelectedNodeId(newNode.id);
  
  return newNode;
};
```

### Handling Offline Mode with Collaboration

```typescript
const { updateNodeContent } = useCanvasNodes();
const { isOffline, pendingChanges, syncPendingChanges } = useYjsIntegration();
const { selectedNodeId } = useCanvasUI();

const handleContentChangeWithOfflineSupport = (content: string) => {
  if (selectedNodeId) {
    // Update local state
    updateNodeContent(selectedNodeId, content);
    
    // Show offline status if applicable
    if (isOffline) {
      console.log(`Changes saved locally. ${pendingChanges} changes pending sync.`);
    }
  }
};

// When back online, sync pending changes
const handleReconnect = async () => {
  if (pendingChanges > 0) {
    await syncPendingChanges();
    console.log('All changes synced successfully');
  }
};
```

## Hook Dependencies

The canvas hooks have the following dependencies:

- **useCanvasNodes**: Depends on AuthContext for user information
- **useCanvasEdges**: Depends on useCanvasNodes for node references
- **useYjsIntegration**: Depends on YjsContext, SocketContext, and NetworkContext
- **useCanvasUI**: Independent, but often used with the other hooks

## Error Handling

All hooks implement consistent error handling:

```typescript
const [error, setError] = useState<Error | null>(null);

const safeOperation = async () => {
  try {
    // Perform the operation
    return result;
  } catch (err) {
    // Set error state
    setError(err instanceof Error ? err : new Error(String(err)));
    // Optionally log the error
    console.error('Operation failed:', err);
    // Return a default value or throw
    return defaultValue;
  }
};
```

## Performance Considerations

- Hooks use memoization (useMemo, useCallback) to prevent unnecessary recalculations
- State updates are batched when possible
- Heavy operations are debounced or throttled
- Async operations use the AbortController API for cleanup

## Testing Hooks

Each hook has comprehensive test coverage:

```typescript
// Example test for useCanvasNodes
test('createNode creates a node with the correct properties', async () => {
  const { result } = renderHook(() => useCanvasNodes());
  
  // Call the hook method
  await act(async () => {
    const position = { x: 100, y: 200 };
    const newNode = await result.current.createNode(position);
    
    // Verify the result
    expect(newNode).toBeDefined();
    expect(newNode.position).toEqual(position);
    expect(newNode.data).toHaveProperty('content');
    expect(result.current.nodes).toContainEqual(expect.objectContaining({
      id: newNode.id
    }));
  });
}); 