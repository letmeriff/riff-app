# Canvas Component Developer Usage Guide

This guide provides instructions for using the refactored Canvas components in your application.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Using Custom Hooks](#using-custom-hooks)
4. [Advanced Customization](#advanced-customization)
5. [Integrating Real-time Collaboration](#integrating-real-time-collaboration)
6. [Error Handling](#error-handling)
7. [Performance Optimization](#performance-optimization)
8. [Feature Flags](#feature-flags)
9. [Testing Your Implementation](#testing-your-implementation)
10. [Common Patterns and Best Practices](#common-patterns-and-best-practices)

## Getting Started

### Prerequisites

Ensure you have the following dependencies installed:

```
npm install reactflow@11.7.2 yjs@13.5.52 y-websocket@1.4.5
```

### Installation

No additional installation is required as the Canvas components are part of the main codebase.

### Import Structure

Components can be imported from the Canvas module:

```typescript
import { 
  CanvasPage, 
  Canvas, 
  CanvasToolbar, 
  CollaborationOverlay, 
  NodeControls 
} from '../components/Canvas';
```

Custom hooks are imported from the canvas hooks module:

```typescript
import {
  useCanvasNodes,
  useCanvasEdges,
  useYjsIntegration,
  useCanvasUI
} from '../hooks/canvas';
```

## Basic Usage

### Minimal Implementation

The simplest way to use the Canvas is with the main `CanvasPage` component:

```tsx
import { CanvasPage } from '../components/Canvas';

function MyCanvas() {
  return (
    <div className="my-app-container">
      <CanvasPage />
    </div>
  );
}
```

### With Node Selection Callback

Adding a node selection callback:

```tsx
import { CanvasPage } from '../components/Canvas';

function MyCanvas() {
  const handleNodeSelect = (nodeId: string | null, content: string | null) => {
    if (nodeId) {
      console.log(`Node ${nodeId} selected with content: ${content}`);
    } else {
      console.log('Node deselected');
    }
  };

  return (
    <div className="my-app-container">
      <CanvasPage onNodeSelect={handleNodeSelect} />
    </div>
  );
}
```

### Read-Only Mode

Creating a read-only canvas:

```tsx
import { CanvasPage } from '../components/Canvas';

function ReadOnlyCanvas() {
  return (
    <div className="read-only-container">
      <CanvasPage readOnly={true} />
    </div>
  );
}
```

## Using Custom Hooks

### Managing Nodes with useCanvasNodes

```tsx
import { useCanvasNodes } from '../hooks/canvas';

function NodeManager() {
  const { 
    nodes, 
    createNode, 
    updateNodeContent, 
    deleteNode 
  } = useCanvasNodes();

  // Create a new node
  const handleCreateNode = async () => {
    const newNode = await createNode({ x: 100, y: 100 });
    console.log(`Node created with ID: ${newNode.id}`);
  };

  // Update a node's content
  const handleUpdateContent = (nodeId: string) => {
    updateNodeContent(nodeId, 'Updated content');
  };

  // Delete a node
  const handleDeleteNode = async (nodeId: string) => {
    await deleteNode(nodeId);
  };

  return (
    <div>
      <button onClick={handleCreateNode}>Create Node</button>
      {nodes.map(node => (
        <div key={node.id}>
          <span>{node.data.content}</span>
          <button onClick={() => handleUpdateContent(node.id)}>Update</button>
          <button onClick={() => handleDeleteNode(node.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

### Managing Edges with useCanvasEdges

```tsx
import { useCanvasEdges } from '../hooks/canvas';

function EdgeManager() {
  const { 
    edges, 
    createEdge, 
    deleteEdge 
  } = useCanvasEdges();

  // Create a new edge
  const handleCreateEdge = () => {
    createEdge('source-node-id', 'target-node-id');
  };

  // Delete an edge
  const handleDeleteEdge = (edgeId: string) => {
    deleteEdge(edgeId);
  };

  return (
    <div>
      <button onClick={handleCreateEdge}>Create Edge</button>
      {edges.map(edge => (
        <div key={edge.id}>
          <span>Edge: {edge.source} → {edge.target}</span>
          <button onClick={() => handleDeleteEdge(edge.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

### Managing UI State with useCanvasUI

```tsx
import { useCanvasUI } from '../hooks/canvas';

function CanvasUIManager() {
  const {
    selectedNodeId,
    selectedNodeContent,
    setSelectedNodeId,
    setSelectedNodeContent,
    isNodeSettingsOpen,
    openNodeSettings,
    closeNodeSettings
  } = useCanvasUI();

  return (
    <div>
      <div>Selected Node: {selectedNodeId || 'None'}</div>
      
      {selectedNodeId && (
        <div>
          <div>Content: {selectedNodeContent}</div>
          <button onClick={() => openNodeSettings(selectedNodeId)}>
            Open Settings
          </button>
        </div>
      )}
      
      {isNodeSettingsOpen && (
        <div className="settings-panel">
          <h3>Node Settings</h3>
          <button onClick={closeNodeSettings}>Close</button>
        </div>
      )}
    </div>
  );
}
```

## Advanced Customization

### Creating a Custom Canvas Implementation

Instead of using the pre-built `CanvasPage`, you can build your own canvas using the lower-level components:

```tsx
import { 
  Canvas, 
  CanvasToolbar, 
  NodeControls 
} from '../components/Canvas';
import { 
  useCanvasNodes, 
  useCanvasEdges, 
  useCanvasUI 
} from '../hooks/canvas';

function CustomCanvas() {
  // Hook setup
  const { 
    nodes, 
    onNodesChange, 
    createNode, 
    updateNodeContent, 
    deleteNode 
  } = useCanvasNodes();
  
  const { 
    edges, 
    onEdgesChange, 
    onConnect 
  } = useCanvasEdges();
  
  const {
    selectedNodeId,
    selectedNodeContent,
    setSelectedNodeId,
    setSelectedNodeContent
  } = useCanvasUI();
  
  // Event handlers
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedNodeContent(node.data.content);
  };
  
  const handleContentChange = (nodeId: string, content: string) => {
    updateNodeContent(nodeId, content);
    setSelectedNodeContent(content);
  };
  
  const handleAddNode = async () => {
    await createNode({ x: 100, y: 100 });
  };
  
  // Find selected node
  const selectedNode = selectedNodeId 
    ? nodes.find(node => node.id === selectedNodeId) 
    : null;
  
  return (
    <div className="custom-canvas-container">
      <CanvasToolbar
        onAddNode={handleAddNode}
        onZoomIn={() => console.log('Zoom in')}
        onZoomOut={() => console.log('Zoom out')}
        onFitView={() => console.log('Fit view')}
      />
      
      <div className="canvas-content">
        <Canvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
        />
        
        {selectedNode && (
          <NodeControls
            node={selectedNode}
            content={selectedNodeContent}
            onContentChange={handleContentChange}
            onDeleteNode={deleteNode}
          />
        )}
      </div>
    </div>
  );
}
```

### Using Custom Node Components

```tsx
import { CanvasPage } from '../components/Canvas';
import MyCustomNodeComponent from './MyCustomNodeComponent';

function CustomNodesCanvas() {
  // Configure the node types
  const nodeTypes = {
    default: MyCustomNodeComponent
  };

  return (
    <div className="custom-nodes-container">
      <CanvasPage nodeTypes={nodeTypes} />
    </div>
  );
}
```

## Integrating Real-time Collaboration

### Basic Collaboration Setup

The canvas components automatically integrate with the YjsContext for real-time collaboration. Make sure the YjsContext provider is set up in your application:

```tsx
import { YjsProvider } from '../contexts/YjsContext';
import { CanvasPage } from '../components/Canvas';

function CollaborativeCanvas() {
  return (
    <YjsProvider roomId="my-canvas-room">
      <CanvasPage collaborationEnabled={true} />
    </YjsProvider>
  );
}
```

### Using Collaboration Features Directly

```tsx
import { useYjsIntegration } from '../hooks/canvas';
import { CollaborationOverlay } from '../components/Canvas';

function CollaborationControls() {
  const {
    isConnected,
    isOffline,
    pendingChanges,
    syncPendingChanges,
    getAwarenessStates
  } = useYjsIntegration();
  
  const connectedUsers = getAwarenessStates();
  const currentUser = { id: 'user-1', name: 'Current User', color: '#0000ff' };
  
  return (
    <div className="collaboration-controls">
      <div className="status">
        {isConnected ? 'Connected' : 'Disconnected'}
        {isOffline && ` (Offline Mode - ${pendingChanges} pending changes)`}
      </div>
      
      {isOffline && pendingChanges > 0 && (
        <button onClick={syncPendingChanges}>
          Sync Changes
        </button>
      )}
      
      <CollaborationOverlay
        connectedUsers={connectedUsers}
        currentUser={currentUser}
        isConnected={isConnected}
        isOffline={isOffline}
        pendingChanges={pendingChanges}
        onForceSyncChanges={syncPendingChanges}
      />
    </div>
  );
}
```

## Error Handling

### Using CanvasErrorBoundary

```tsx
import { CanvasPage } from '../components/Canvas';
import CanvasErrorBoundary from '../components/Canvas/components/CanvasErrorBoundary';

function CanvasWithErrorHandling() {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log error to service
    console.error('Canvas error:', error, errorInfo);
  };
  
  return (
    <CanvasErrorBoundary 
      onError={handleError}
      fallback={(error, reset) => (
        <div className="error-container">
          <h2>Canvas Error</h2>
          <p>{error.message}</p>
          <button onClick={reset}>Try Again</button>
        </div>
      )}
    >
      <CanvasPage />
    </CanvasErrorBoundary>
  );
}
```

### Custom Error Handling in Hooks

```tsx
import { useCanvasNodes } from '../hooks/canvas';
import { useState } from 'react';

function NodeManagerWithErrorHandling() {
  const [error, setError] = useState<Error | null>(null);
  const { createNode, deleteNode } = useCanvasNodes();
  
  const handleCreateNodeSafely = async () => {
    try {
      const newNode = await createNode();
      console.log('Node created:', newNode.id);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error('Failed to create node:', err);
    }
  };
  
  return (
    <div className="node-manager">
      {error && (
        <div className="error-banner">
          Error: {error.message}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      <button onClick={handleCreateNodeSafely}>
        Create Node
      </button>
    </div>
  );
}
```

## Performance Optimization

### Using Virtualization

Virtualization is enabled by default when the `ENABLE_VIRTUALIZATION` feature flag is set to true. You can also explicitly enable it:

```tsx
import { CanvasPage } from '../components/Canvas';

function OptimizedCanvas() {
  return (
    <CanvasPage
      featureFlags={{
        enableVirtualization: true
      }}
    />
  );
}
```

### Monitoring Performance

```tsx
import { CanvasPage } from '../components/Canvas';
import { PerformanceMonitor } from '../components/Canvas/components/PerformanceMonitor';
import { useState } from 'react';

function CanvasWithPerformanceMonitoring() {
  const [metrics, setMetrics] = useState({
    fps: 60,
    nodeCount: 0,
    edgeCount: 0,
    renderTime: 0
  });
  
  const handleMetricsUpdate = (newMetrics) => {
    setMetrics(newMetrics);
    // Log metrics to analytics service
    if (newMetrics.fps < 30) {
      console.warn('Low FPS detected');
    }
  };
  
  return (
    <div className="performance-container">
      <CanvasPage 
        featureFlags={{
          enablePerformanceMonitoring: true
        }}
      />
      
      <PerformanceMonitor
        enabled={true}
        metrics={metrics}
        position="bottom-right"
        onMetricsUpdate={handleMetricsUpdate}
      />
    </div>
  );
}
```

### Manual Performance Optimizations

```tsx
import { useCanvasNodes } from '../hooks/canvas';
import { useCallback, useMemo } from 'react';

function OptimizedNodeList() {
  const { nodes, updateNodeContent } = useCanvasNodes();
  
  // Memoize expensive calculations
  const nodeStats = useMemo(() => {
    return {
      total: nodes.length,
      connected: nodes.filter(node => node.data.connected).length,
      average: nodes.reduce((sum, node) => sum + node.data.value, 0) / nodes.length
    };
  }, [nodes]);
  
  // Memoize event handlers
  const handleContentChange = useCallback((nodeId: string, content: string) => {
    updateNodeContent(nodeId, content);
  }, [updateNodeContent]);
  
  return (
    <div className="node-list">
      <div className="stats">
        Total: {nodeStats.total}, 
        Connected: {nodeStats.connected}, 
        Average: {nodeStats.average}
      </div>
      
      {/* Only render a limited number of nodes */}
      {nodes.slice(0, 50).map(node => (
        <div key={node.id} className="node-item">
          {node.data.content}
        </div>
      ))}
      
      {nodes.length > 50 && (
        <div className="more-indicator">
          + {nodes.length - 50} more nodes
        </div>
      )}
    </div>
  );
}
```

## Feature Flags

### Setting Feature Flags

Feature flags can be set in different ways:

1. Environment variables:
```
# .env.development
REACT_APP_ENABLE_PERFORMANCE_MONITORING=true
REACT_APP_ENABLE_VIRTUALIZATION=true
REACT_APP_ENABLE_ERROR_REPORTING=true
```

2. Props override:
```tsx
<CanvasPage
  featureFlags={{
    enablePerformanceMonitoring: true,
    enableVirtualization: true,
    enableErrorReporting: true
  }}
/>
```

### Creating Custom Feature Flags

You can define and use your own feature flags:

```tsx
// Define custom feature flags
const ENABLE_EXPERIMENTAL_FEATURE = process.env.REACT_APP_ENABLE_EXPERIMENTAL_FEATURE === 'true';

function CanvasWithCustomFeatures() {
  return (
    <div>
      <CanvasPage />
      
      {ENABLE_EXPERIMENTAL_FEATURE && (
        <div className="experimental-ui">
          Experimental Feature Enabled
        </div>
      )}
    </div>
  );
}
```

## Testing Your Implementation

### Integration Testing Example

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanvasPage } from '../components/Canvas';
import { YjsProvider } from '../contexts/YjsContext';

// Mock the hooks and services
jest.mock('../hooks/canvas/useYjsIntegration', () => ({
  useYjsIntegration: () => ({
    isConnected: true,
    isOffline: false,
    pendingChanges: 0,
    getAwarenessStates: () => []
  })
}));

test('Canvas allows adding and selecting nodes', async () => {
  const handleNodeSelect = jest.fn();
  
  render(
    <YjsProvider roomId="test-room">
      <CanvasPage onNodeSelect={handleNodeSelect} />
    </YjsProvider>
  );
  
  // Find and click the "Add Node" button
  const addButton = screen.getByRole('button', { name: /add node/i });
  userEvent.click(addButton);
  
  // Wait for the node to appear
  const nodeElement = await screen.findByTestId(/node/);
  expect(nodeElement).toBeInTheDocument();
  
  // Click the node and check if selection callback was called
  userEvent.click(nodeElement);
  expect(handleNodeSelect).toHaveBeenCalled();
  
  // Verify that selected node content appears in the node controls
  const contentEditor = screen.getByTestId('content-editor');
  expect(contentEditor).toBeInTheDocument();
});
```

### Component Testing Example

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanvasToolbar } from '../components/Canvas/components/CanvasToolbar';

test('CanvasToolbar calls the correct callbacks', () => {
  const handleAddNode = jest.fn();
  const handleZoomIn = jest.fn();
  const handleZoomOut = jest.fn();
  
  render(
    <CanvasToolbar
      onAddNode={handleAddNode}
      onZoomIn={handleZoomIn}
      onZoomOut={handleZoomOut}
      onFitView={() => {}}
    />
  );
  
  // Find buttons
  const addButton = screen.getByRole('button', { name: /add node/i });
  const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
  const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
  
  // Click buttons
  userEvent.click(addButton);
  userEvent.click(zoomInButton);
  userEvent.click(zoomOutButton);
  
  // Verify callbacks were called
  expect(handleAddNode).toHaveBeenCalledTimes(1);
  expect(handleZoomIn).toHaveBeenCalledTimes(1);
  expect(handleZoomOut).toHaveBeenCalledTimes(1);
});
```

## Common Patterns and Best Practices

### Combining Multiple Hooks

The hooks are designed to work together. Here's how to combine them effectively:

```tsx
function CombinedHooksExample() {
  // Initialize hooks
  const nodesHook = useCanvasNodes();
  const edgesHook = useCanvasEdges();
  const yjsHook = useYjsIntegration();
  const uiHook = useCanvasUI();
  
  // Create a node with real-time sync
  const handleCreateNodeWithSync = async () => {
    const newNode = await nodesHook.createNode();
    yjsHook.syncToYjs([newNode], []);
    uiHook.setSelectedNodeId(newNode.id);
    return newNode;
  };
  
  // Connect nodes with real-time sync
  const handleConnectNodesWithSync = (sourceId: string, targetId: string) => {
    const newEdge = edgesHook.createEdge(sourceId, targetId);
    yjsHook.syncToYjs([], [newEdge]);
    return newEdge;
  };
  
  return (
    <div>
      <button onClick={handleCreateNodeWithSync}>Create Synced Node</button>
      {/* Other UI */}
    </div>
  );
}
```

### Implementing Custom Node Types

Create custom node types by extending the base ChatNode component:

```tsx
// MyCustomNode.tsx
import React from 'react';
import { Handle, Position } from 'reactflow';

interface MyCustomNodeProps {
  data: {
    content: string;
    label: string;
    customField?: string;
  };
  selected: boolean;
}

const MyCustomNode: React.FC<MyCustomNodeProps> = ({ data, selected }) => {
  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      
      <div className="node-content">
        <h3>{data.label}</h3>
        <p>{data.content}</p>
        {data.customField && (
          <div className="custom-field">{data.customField}</div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default React.memo(MyCustomNode);
```

Then register and use your custom node:

```tsx
import MyCustomNode from './MyCustomNode';
import { CanvasPage } from '../components/Canvas';

function CustomNodesExample() {
  const nodeTypes = {
    customNode: MyCustomNode
  };
  
  return (
    <CanvasPage nodeTypes={nodeTypes} />
  );
}
```

### Building a Canvas with Sidebars

```tsx
import { CanvasPage } from '../components/Canvas';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';

function CanvasWithSidebars() {
  return (
    <div className="canvas-layout">
      <LeftSidebar />
      
      <div className="canvas-container">
        <CanvasPage />
      </div>
      
      <RightSidebar />
    </div>
  );
}
```

### Handling Window Resize

```tsx
import { useEffect } from 'react';
import { CanvasPage } from '../components/Canvas';

function ResponsiveCanvas() {
  useEffect(() => {
    const handleResize = () => {
      // Trigger canvas resize logic if needed
      console.log('Window resized');
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return <CanvasPage />;
}
```

### Setting Initial Canvas State

```tsx
import { CanvasPage } from '../components/Canvas';

function CanvasWithInitialState() {
  const initialNodes = [
    {
      id: 'node-1',
      position: { x: 100, y: 100 },
      data: { content: 'Initial node 1', label: 'Node 1' }
    },
    {
      id: 'node-2',
      position: { x: 300, y: 200 },
      data: { content: 'Initial node 2', label: 'Node 2' }
    }
  ];
  
  const initialEdges = [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2'
    }
  ];
  
  return (
    <CanvasPage
      initialNodes={initialNodes}
      initialEdges={initialEdges}
    />
  );
}
```

### Canvas Event Logging for Debugging

```tsx
import { CanvasPage } from '../components/Canvas';

function CanvasWithEventLogging() {
  const handleNodeSelect = (nodeId: string | null, content: string | null) => {
    console.log('Node selected:', { nodeId, content });
  };
  
  const handleNodeSettings = (nodeId: string) => {
    console.log('Settings opened for node:', nodeId);
  };
  
  return (
    <CanvasPage
      onNodeSelect={handleNodeSelect}
      onOpenSettings={handleNodeSettings}
    />
  );
}
```

### Common Troubleshooting Tips

1. **Node Not Rendering**: Ensure that you're using the correct node type and that the data structure matches what the node component expects.

2. **Real-time Sync Issues**: Check that YjsContext is properly configured and that the room ID is correct.

3. **Performance Problems**: Consider enabling virtualization and check the performance monitor for bottlenecks.

4. **Edge Connection Issues**: Verify that nodes have the correct handle components and that edge types are properly registered.

5. **Node Position Issues**: If node positions are inconsistent, verify that position updates are being properly synchronized with Yjs. 