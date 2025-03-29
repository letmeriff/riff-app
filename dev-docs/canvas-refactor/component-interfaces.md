# Canvas Component Interfaces

This document provides detailed documentation of the component interfaces used in the Canvas refactoring.

## CanvasPage

The top-level container component that manages the entire canvas experience.

### Props

```typescript
interface CanvasPageProps {
  // Optional callback when a node is selected
  onNodeSelect?: (nodeId: string | null, content: string | null) => void;
  
  // Optional callback when settings should be opened
  onOpenSettings?: (nodeId: string) => void;
  
  // Optional initial canvas state
  initialNodes?: Node[];
  initialEdges?: Edge[];
  
  // Optional mode settings
  readOnly?: boolean;
  collaborationEnabled?: boolean;
  
  // Feature flags override (optional)
  featureFlags?: {
    enablePerformanceMonitoring?: boolean;
    enableVirtualization?: boolean;
    enableErrorReporting?: boolean;
  };
}
```

### Example Usage

```tsx
import { CanvasPage } from '../components/Canvas';

const MyCanvasContainer: React.FC = () => {
  const handleNodeSelect = (nodeId: string | null, content: string | null) => {
    console.log('Node selected:', nodeId, content);
  };
  
  return (
    <div className="my-canvas-container">
      <CanvasPage
        onNodeSelect={handleNodeSelect}
        collaborationEnabled={true}
        featureFlags={{
          enablePerformanceMonitoring: true
        }}
      />
    </div>
  );
};
```

## Canvas

The core ReactFlow wrapper component that renders the canvas.

### Props

```typescript
interface CanvasProps {
  // Required props
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  
  // Optional event handlers
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onNodeDragStop?: (event: React.MouseEvent, node: Node) => void;
  onSelectionChange?: (elements: { nodes: Node[]; edges: Edge[] }) => void;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
  
  // Optional state
  isOfflineMode?: boolean;
  readOnly?: boolean;
  
  // Optional children to render inside the canvas
  children?: React.ReactNode;
}
```

### Example Usage

```tsx
import { Canvas } from '../components/Canvas';
import { useCanvasNodes, useCanvasEdges } from '../hooks/canvas';

const MyCanvas: React.FC = () => {
  const { nodes, onNodesChange } = useCanvasNodes();
  const { edges, onEdgesChange, onConnect } = useCanvasEdges();
  
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node.id);
  };
  
  return (
    <Canvas
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={handleNodeClick}
      readOnly={false}
    />
  );
};
```

## CanvasToolbar

Provides controls for common canvas operations.

### Props

```typescript
interface CanvasToolbarProps {
  // Required callbacks
  onAddNode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  
  // Optional callbacks
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onExport?: () => void;
  
  // Optional state
  isReadOnly?: boolean;
  isOffline?: boolean;
  pendingChanges?: number;
  canUndo?: boolean;
  canRedo?: boolean;
}
```

### Example Usage

```tsx
import { CanvasToolbar } from '../components/Canvas/components/CanvasToolbar';

const MyCanvasToolbar: React.FC = () => {
  const handleAddNode = () => {
    console.log('Add node clicked');
  };
  
  const handleZoomIn = () => {
    console.log('Zoom in clicked');
  };
  
  return (
    <CanvasToolbar
      onAddNode={handleAddNode}
      onZoomIn={handleZoomIn}
      onZoomOut={() => console.log('Zoom out clicked')}
      onFitView={() => console.log('Fit view clicked')}
      onUndo={() => console.log('Undo clicked')}
      onRedo={() => console.log('Redo clicked')}
      isReadOnly={false}
      isOffline={false}
      canUndo={true}
      canRedo={false}
    />
  );
};
```

## CollaborationOverlay

Displays real-time collaboration information.

### Props

```typescript
interface CollaborationOverlayProps {
  // User awareness
  connectedUsers: User[];
  currentUser: User;
  
  // Connection state
  isConnected: boolean;
  isOffline: boolean;
  pendingChanges: number;
  
  // Optional callbacks
  onForceSyncChanges?: () => Promise<void>;
  onToggleOfflineMode?: () => void;
}

interface User {
  id: string;
  name: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
  };
}
```

### Example Usage

```tsx
import { CollaborationOverlay } from '../components/Canvas/components/CollaborationOverlay';

const MyCollaborationOverlay: React.FC = () => {
  const connectedUsers = [
    { id: 'user-1', name: 'Alice', color: '#ff0000', cursor: { x: 100, y: 100 } },
    { id: 'user-2', name: 'Bob', color: '#00ff00', cursor: { x: 200, y: 200 } }
  ];
  
  const currentUser = { id: 'user-3', name: 'Charlie', color: '#0000ff' };
  
  return (
    <CollaborationOverlay
      connectedUsers={connectedUsers}
      currentUser={currentUser}
      isConnected={true}
      isOffline={false}
      pendingChanges={0}
      onForceSyncChanges={async () => console.log('Syncing changes...')}
    />
  );
};
```

## NodeControls

Provides controls for node editing and management.

### Props

```typescript
interface NodeControlsProps {
  // Node data
  node: Node | null;
  content: string | null;
  
  // Callbacks
  onContentChange: (nodeId: string, content: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onOpenSettings?: (nodeId: string) => void;
  
  // Optional state
  isReadOnly?: boolean;
}
```

### Example Usage

```tsx
import { NodeControls } from '../components/Canvas/components/NodeControls';
import { useCanvasNodes } from '../hooks/canvas';
import { useCanvasUI } from '../hooks/canvas';

const MyNodeControls: React.FC = () => {
  const { updateNodeContent, deleteNode } = useCanvasNodes();
  const { selectedNodeId, selectedNodeContent } = useCanvasUI();
  
  const selectedNode = selectedNodeId ? nodes.find(node => node.id === selectedNodeId) : null;
  
  const handleContentChange = (nodeId: string, content: string) => {
    updateNodeContent(nodeId, content);
  };
  
  const handleDeleteNode = (nodeId: string) => {
    deleteNode(nodeId);
  };
  
  return (
    <NodeControls
      node={selectedNode}
      content={selectedNodeContent}
      onContentChange={handleContentChange}
      onDeleteNode={handleDeleteNode}
      onOpenSettings={(nodeId) => console.log('Open settings for node:', nodeId)}
      isReadOnly={false}
    />
  );
};
```

## PerformanceMonitor

Monitors and displays performance metrics for the canvas.

### Props

```typescript
interface PerformanceMonitorProps {
  // Whether to display the monitor
  enabled: boolean;
  
  // Metrics to display
  metrics: PerformanceMetrics;
  
  // Optional settings
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  refreshRate?: number; // in milliseconds
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
}

interface PerformanceMetrics {
  fps?: number;
  nodeCount?: number;
  edgeCount?: number;
  renderTime?: number;
  memoryUsage?: number;
  networkOperations?: number;
  // Additional custom metrics
  [key: string]: number | undefined;
}
```

### Example Usage

```tsx
import { PerformanceMonitor } from '../components/Canvas/components/PerformanceMonitor';

const MyCanvasWithMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    nodeCount: 50,
    edgeCount: 75,
    renderTime: 5.2,
    memoryUsage: 24.5
  });
  
  const handleMetricsUpdate = (newMetrics: PerformanceMetrics) => {
    console.log('Performance metrics updated:', newMetrics);
    setMetrics(newMetrics);
  };
  
  return (
    <div>
      <Canvas {...canvasProps} />
      
      <PerformanceMonitor
        enabled={true}
        metrics={metrics}
        position="bottom-right"
        refreshRate={1000}
        onMetricsUpdate={handleMetricsUpdate}
      />
    </div>
  );
};
```

## CanvasErrorBoundary

Catches and handles errors in the canvas.

### Props

```typescript
interface CanvasErrorBoundaryProps {
  // Required props
  children: React.ReactNode;
  
  // Optional callbacks
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
  
  // Optional customization
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  maxRetries?: number;
}
```

### Example Usage

```tsx
import CanvasErrorBoundary from '../components/Canvas/components/CanvasErrorBoundary';

const MyCanvasWithErrorHandling: React.FC = () => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Canvas error:', error);
    // Report to error tracking service
  };
  
  const handleReset = () => {
    console.log('Canvas error boundary reset');
    // Perform any cleanup or state reset
  };
  
  const customFallback = (error: Error, reset: () => void) => (
    <div className="error-container">
      <h2>Something went wrong with the canvas</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try Again</button>
    </div>
  );
  
  return (
    <CanvasErrorBoundary
      onError={handleError}
      onReset={handleReset}
      fallback={customFallback}
      maxRetries={3}
    >
      <CanvasPage />
    </CanvasErrorBoundary>
  );
};
```

## Props Type Definitions

### Node and Edge Types

```typescript
// Extended from ReactFlow's Node type
interface Node<T = any> {
  id: string;
  position: XYPosition;
  data: NodeData<T>;
  type?: string;
  style?: React.CSSProperties;
  className?: string;
  // Additional ReactFlow node properties
}

interface NodeData<T = any> {
  content: string;
  label: string;
  type?: string;
  metadata?: {
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
  // Custom application data
  customData?: T;
}

// Extended from ReactFlow's Edge type
interface Edge<T = any> {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  label?: string;
  data?: T;
  style?: React.CSSProperties;
  className?: string;
  // Additional ReactFlow edge properties
}
```

### Viewport Type

```typescript
interface Viewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  zoom: number;
}
```

## Component Composition Best Practices

### Top-Level Composition

```tsx
const CanvasApplication: React.FC = () => {
  return (
    <div className="canvas-application">
      <CanvasErrorBoundary>
        <CanvasPage 
          onNodeSelect={(nodeId, content) => console.log('Selected:', nodeId)}
          collaborationEnabled={true}
        />
      </CanvasErrorBoundary>
    </div>
  );
};
```

### Custom Canvas with Toolbar

```tsx
const CustomCanvas: React.FC = () => {
  const { 
    nodes, 
    onNodesChange, 
    createNode, 
    deleteNode 
  } = useCanvasNodes();
  
  const { 
    edges, 
    onEdgesChange, 
    onConnect 
  } = useCanvasEdges();
  
  const handleAddNode = () => {
    createNode({ x: 100, y: 100 });
  };
  
  return (
    <div className="custom-canvas-container">
      <CanvasToolbar
        onAddNode={handleAddNode}
        onZoomIn={() => console.log('Zoom in')}
        onZoomOut={() => console.log('Zoom out')}
        onFitView={() => console.log('Fit view')}
      />
      
      <Canvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
      />
    </div>
  );
};
```

### Advanced Integration with All Components

```tsx
import { 
  Canvas, 
  CanvasToolbar, 
  CollaborationOverlay, 
  NodeControls, 
  PerformanceMonitor 
} from '../components/Canvas';
import { 
  useCanvasNodes, 
  useCanvasEdges, 
  useYjsIntegration, 
  useCanvasUI 
} from '../hooks/canvas';

const AdvancedCanvas: React.FC = () => {
  // Get hooks
  const nodesHook = useCanvasNodes();
  const edgesHook = useCanvasEdges();
  const yjsHook = useYjsIntegration();
  const uiHook = useCanvasUI();
  
  // Performance metrics state
  const [metrics, setMetrics] = useState({
    fps: 60,
    nodeCount: nodesHook.nodes.length,
    edgeCount: edgesHook.edges.length
  });
  
  // Get the selected node
  const selectedNode = uiHook.selectedNodeId 
    ? nodesHook.nodes.find(node => node.id === uiHook.selectedNodeId) 
    : null;
  
  return (
    <div className="advanced-canvas">
      <CanvasToolbar
        onAddNode={() => nodesHook.createNode()}
        onZoomIn={() => console.log('Zoom in')}
        onZoomOut={() => console.log('Zoom out')}
        onFitView={() => console.log('Fit view')}
        isOffline={yjsHook.isOffline}
        pendingChanges={yjsHook.pendingChanges}
      />
      
      <div className="canvas-main-area">
        <Canvas
          nodes={nodesHook.nodes}
          edges={edgesHook.edges}
          onNodesChange={nodesHook.onNodesChange}
          onEdgesChange={edgesHook.onEdgesChange}
          onConnect={edgesHook.onConnect}
          onNodeClick={(_, node) => uiHook.setSelectedNodeId(node.id)}
          onNodeDragStop={(_, node) => nodesHook.updateNodePosition(node.id, node.position)}
          isOfflineMode={yjsHook.isOffline}
        >
          <CollaborationOverlay
            connectedUsers={yjsHook.getAwarenessStates()}
            currentUser={{ id: 'current-user', name: 'Current User', color: '#0000ff' }}
            isConnected={yjsHook.isConnected}
            isOffline={yjsHook.isOffline}
            pendingChanges={yjsHook.pendingChanges}
            onForceSyncChanges={yjsHook.syncPendingChanges}
          />
        </Canvas>
        
        {selectedNode && (
          <NodeControls
            node={selectedNode}
            content={uiHook.selectedNodeContent}
            onContentChange={(nodeId, content) => {
              nodesHook.updateNodeContent(nodeId, content);
              uiHook.setSelectedNodeContent(content);
            }}
            onDeleteNode={(nodeId) => {
              nodesHook.deleteNode(nodeId);
              uiHook.setSelectedNodeId(null);
            }}
          />
        )}
      </div>
      
      <PerformanceMonitor
        enabled={true}
        metrics={metrics}
        position="bottom-right"
        onMetricsUpdate={setMetrics}
      />
    </div>
  );
};
```

## Testing Components

Each component includes comprehensive tests:

```typescript
// Example test for Canvas component
test('Canvas renders nodes and edges correctly', () => {
  const testNodes = [
    { id: 'node-1', position: { x: 100, y: 100 }, data: { content: 'Node 1' } }
  ];
  const testEdges = [
    { id: 'edge-1', source: 'node-1', target: 'node-2' }
  ];
  
  const onNodesChangeMock = jest.fn();
  const onEdgesChangeMock = jest.fn();
  const onConnectMock = jest.fn();
  
  const { getByTestId } = render(
    <Canvas
      nodes={testNodes}
      edges={testEdges}
      onNodesChange={onNodesChangeMock}
      onEdgesChange={onEdgesChangeMock}
      onConnect={onConnectMock}
    />
  );
  
  // Check that ReactFlow is rendering
  expect(getByTestId('react-flow')).toBeInTheDocument();
  
  // Check that background and controls are rendered
  expect(getByTestId('react-flow-background')).toBeInTheDocument();
  expect(getByTestId('react-flow-controls')).toBeInTheDocument();
});
``` 