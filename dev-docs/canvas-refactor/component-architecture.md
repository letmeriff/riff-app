# CanvasPage Component Architecture

## Overview

The refactored CanvasPage architecture follows a hierarchical component structure with clear separation of concerns. The design uses custom hooks for stateful logic and smaller, focused components for UI rendering. This document outlines the proposed architecture, component responsibilities, and data flow.

## Component Hierarchy

```
CanvasPageContainer
├── CanvasContext (Provider)
│   ├── Canvas (ReactFlow wrapper)
│   │   ├── NodeRenderer
│   │   │   └── ChatNode
│   │   ├── EdgeRenderer
│   │   ├── Background
│   │   ├── Controls
│   │   └── MiniMap
│   ├── CollaborationOverlay
│   │   ├── UserCursors
│   │   └── CollaborationStatus
│   ├── CanvasToolbar
│   │   ├── NodeCreationTools
│   │   ├── CanvasControls
│   │   └── CollaborationControls
│   ├── FloatingMenu (contextual)
│   └── NodeSettingsPanel (when node selected)
└── LibrarySidebar (external component)
```

## Core Components

### CanvasPageContainer

The top-level container component that:
- Initializes the canvas context
- Handles URL parameters and routing
- Provides dependency injection for services
- Manages global canvas state

### CanvasContext (Provider)

A context provider that:
- Manages shared canvas state
- Provides access to canvas operations
- Coordinates between components
- Connects custom hooks

### Canvas

The core rendering component that:
- Wraps ReactFlow
- Manages viewport and zoom
- Handles pan and drag events
- Coordinates node and edge rendering

### CollaborationOverlay

Displays real-time collaboration information:
- Renders user cursors
- Shows connection status
- Displays offline changes count
- Provides sync controls

### CanvasToolbar

The main toolbar component that:
- Provides node creation tools
- Offers canvas manipulation controls
- Shows collaboration options
- Provides access to settings

### FloatingMenu

A contextual menu that:
- Appears at cursor position
- Provides quick access to common actions
- Changes based on selection context

### NodeSettingsPanel

A panel that:
- Shows when a node is selected
- Displays node properties
- Allows editing node settings
- Shows node relationships

## Custom Hooks

### useCanvasNodes

Manages node data and operations:
- CRUD operations for nodes
- Node data synchronization
- Node metadata management
- Batch operations

#### API

```typescript
const {
  nodes,
  createNode,
  updateNode,
  deleteNode,
  getNodeById,
  batchUpdateNodes
} = useCanvasNodes();
```

### useNodePositioning

Handles node positioning logic:
- Position updates
- Position synchronization
- Conflict resolution
- Position history

#### API

```typescript
const {
  updateNodePosition,
  getNodePosition,
  getPositionHistory,
  resolvePositionConflict
} = useNodePositioning();
```

### useCanvasEdges

Manages edge data and operations:
- CRUD operations for edges
- Edge data synchronization
- Edge relationship management

#### API

```typescript
const {
  edges,
  createEdge,
  updateEdge,
  deleteEdge,
  getConnectedEdges
} = useCanvasEdges();
```

### useYjsIntegration

Handles Yjs document binding:
- Document initialization
- Change synchronization
- Conflict resolution
- Document subscription

#### API

```typescript
const {
  ydoc,
  isConnected,
  syncChangesToYjs,
  subscribeToYjsChanges,
  resolveConflicts
} = useYjsIntegration();
```

### useCollaborationAwareness

Manages user presence and awareness:
- User cursors
- Typing indicators
- User activity tracking
- Connection status

#### API

```typescript
const {
  connectedUsers,
  updateCursorPosition,
  setTypingStatus,
  getActiveUsers
} = useCollaborationAwareness();
```

### useOfflineSupport

Handles offline functionality:
- Offline change tracking
- Change queue management
- Reconnection handling
- Sync status

#### API

```typescript
const {
  isOffline,
  pendingChanges,
  syncStatus,
  forceSyncChanges,
  clearPendingChanges
} = useOfflineSupport();
```

### useCanvasUI

Manages UI state:
- Modal visibility
- Toolbar state
- Panel visibility
- UI preferences

#### API

```typescript
const {
  uiState,
  showModal,
  hideModal,
  togglePanel,
  setToolbarState
} = useCanvasUI();
```

## Data Flow

### Node Creation Flow

1. User clicks "Create Node" button in CanvasToolbar
2. CanvasToolbar calls `createNode()` from context
3. useCanvasNodes hook creates node in local state
4. useYjsIntegration sync changes to Yjs document
5. Node is rendered in Canvas component
6. NodeRenderer renders ChatNode component
7. useCollaborationAwareness broadcasts node creation

### Node Position Update Flow

1. User drags node in Canvas
2. Canvas calls onNodeDrag with position update
3. useNodePositioning updates position in local state
4. useYjsIntegration syncs position to Yjs document
5. Canvas re-renders with new position
6. useOfflineSupport queues change if offline
7. Position is saved to backend when appropriate

### Collaboration Status Change Flow

1. Network status changes (offline/online)
2. useOfflineSupport detects change and updates state
3. useYjsIntegration updates connection status
4. CollaborationStatus component re-renders with new status
5. CanvasToolbar enables/disables collaborative features
6. Queued changes are synced when back online

## State Management

The refactored architecture uses a combination of:

1. **React Context**: For shared canvas state
2. **Custom Hooks**: For domain-specific state and logic
3. **Component State**: For UI-specific state
4. **Yjs Document**: For collaborative state

## Service Dependencies

The components depend on these services:

1. **nodeService**: For node CRUD operations
2. **yjsService**: For Yjs document operations
3. **supabase**: For database operations
4. **authContext**: For user authentication
5. **socketContext**: For real-time communication 