# Yjs Migration Developer Brief

## Current System Overview

### Project Context

The application is a collaborative canvas tool that allows multiple users to create, position, and interact with nodes in a shared workspace. The system is currently in MVP/prototyping phase with a custom-built real-time collaboration mechanism.

### Current Architecture

#### Frontend

- **Tech Stack**: React with React Flow for the canvas visualization
- **State Management**: Local React state with optimistic updates
- **Real-time Updates**: Socket.IO for primary communication, Supabase Realtime as fallback

#### Backend

- **Server**: Node.js with Socket.IO for real-time message distribution
- **Database**: Supabase (PostgreSQL) for persistence
- **Real-time Protocol**: Custom implementation using vector clocks and Lamport timestamps

#### Collaboration Implementation

- **Conflict Resolution**: Custom CRDT-inspired approach using vector clocks
- **Position Synchronization**: Updates propagated via Socket.IO with backend validation
- **State Tracking**: Vector clocks stored in database to track node update history

### Key Code Components

1. **Node Position Management** (`frontend/src/services/nodeService.ts`):

   - `updateNodePosition`: Core function that handles position updates with vector clocks
   - Uses optimistic updates locally before confirmation

2. **Canvas Page** (`frontend/src/pages/CanvasPage.tsx`):

   - Manages node rendering, user interactions, and real-time updates
   - Handles Socket.IO events for position updates from other users
   - Implements periodic position saving and fallback mechanisms

3. **Backend Socket Handler** (`backend/src/index.ts`):

   - Receives position updates via Socket.IO
   - Validates and applies updates to the database
   - Broadcasts changes to other connected clients

4. **Database Schema**:

   - `chat_nodes`: Stores node data including position and vector clock
   - `node_position_history`: Tracks history of position changes with conflict resolution metadata

5. **CRDT Implementation**:
   - Custom SQL function `update_node_position_crdt` for applying position updates
   - Implements vector clock comparison and conflict resolution

### Current Limitations

1. **Custom CRDT Implementation**: Requires ongoing maintenance and has edge cases
2. **Limited Offline Support**: Basic handling without comprehensive offline editing
3. **Scalability Concerns**: Custom implementation may have performance issues at scale
4. **Limited Collaboration Features**: Missing presence awareness, cursor sharing, etc.

## Migration Goal

Replace the custom real-time collaboration system with Yjs, a mature CRDT framework designed for collaborative editing, while maintaining existing functionality and improving the collaboration experience.

## Yjs Overview

### What is Yjs?

Yjs is a high-performance CRDT framework for building collaborative applications. It provides:

1. **Shared Data Types**: Map, Array, Text, etc. that automatically sync
2. **Network Agnostic**: Works with any network provider (WebSocket, WebRTC, etc.)
3. **Conflict Resolution**: Built-in conflict resolution that preserves user intent
4. **Offline Support**: First-class support for offline editing
5. **Awareness Protocol**: Built-in user presence and cursor sharing

### Key Advantages for Our Project

1. **Mature Implementation**: Battle-tested in production applications
2. **Performance Optimizations**: Efficient sync protocol and document size management
3. **Rich Feature Set**: Awareness, offline editing, undo/redo history
4. **Active Community**: Well-maintained with good documentation

## Technical Resources for Implementation

### Essential Documentation

1. **Yjs Documentation**: https://docs.yjs.dev/
2. **Getting Started Guide**: https://docs.yjs.dev/getting-started/a-collaborative-editor
3. **API Reference**: https://docs.yjs.dev/api/y.doc

### Key Libraries

1. **yjs**: Core library for CRDT implementation
2. **y-websocket**: Network provider using WebSockets
3. **y-indexeddb**: Client-side persistence using IndexedDB
4. **y-protocols**: Awareness protocol for user presence

### React Flow Integration Resources

1. **React Flow Documentation**: https://reactflow.dev/
2. **Custom Node Types**: https://reactflow.dev/docs/api/nodes/custom-nodes/
3. **State Management**: https://reactflow.dev/docs/guides/state-management/

## Development Environment Setup

### Required Dependencies

```
npm install yjs y-websocket y-indexeddb @types/yjs
```

### Development Tools

1. **Y-Websocket Server**: Simple implementation of a WebSocket server for Yjs
2. **Yjs Developer Tools**: Browser extension for debugging Yjs documents
3. **Supabase CLI**: For database migrations and local development

## Implementation Considerations

### Critical Areas to Focus On

1. **Document Structure Design**: Carefully map application entities to Yjs shared types
2. **Synchronization Protocol**: Understand how updates flow between clients
3. **State Mapping**: Bidirectional flow between React Flow and Yjs document
4. **Persistence Strategy**: How to efficiently store Yjs documents in Supabase

### Common Pitfalls

1. **Document Structure Changes**: Avoid restructuring the Yjs document after deployment
2. **Large Documents**: Be mindful of document size for complex canvases
3. **Network Provider Configuration**: Ensure proper authentication and connection handling
4. **Update Frequency**: High-frequency updates may need throttling

### Technical Debt Avoidance

1. **Clean Abstractions**: Use adapter pattern to isolate Yjs implementation
2. **Clear Boundaries**: Separate concerns between document, UI, and network
3. **Progressive Enhancement**: Add collaboration features incrementally
4. **Testing Harness**: Build test cases for concurrent editing scenarios

## Example Implementation Patterns

### Document Structure

```javascript
// Conceptual structure - not actual code
const ydoc = new Y.Doc();
const nodes = ydoc.getMap('nodes');
const edges = ydoc.getMap('edges');

// Example node structure
nodes.set('node1', new Y.Map());
nodes.get('node1').set('position', new Y.Map());
nodes.get('node1').get('position').set('x', 100);
nodes.get('node1').get('position').set('y', 200);
nodes.get('node1').set('title', new Y.Text('Node Title'));
```

### Persistence Strategy

1. **Document Updates**: Store binary encoded updates in `yjs_updates` table
2. **Snapshots**: Periodically store full document state in `yjs_documents` table
3. **Initial Load**: Load latest snapshot + subsequent updates

### Awareness Features

1. **User Cursors**: Show remote user positions on canvas
2. **Edit Indicators**: Highlight nodes being edited by others
3. **Presence**: Show which users are currently viewing the canvas

## Next Steps

1. **Prototype Basic Integration**: Start with a simple Yjs document structure
2. **Implement Core Sync**: Set up basic synchronization without UI changes
3. **Add UI Integration**: Connect React Flow to Yjs document
4. **Implement Persistence**: Add server-side storage solution
5. **Enhance with Awareness**: Add collaboration UI features

This migration represents an opportunity to significantly improve the collaboration capabilities of the application while leveraging a proven, well-supported library instead of maintaining a custom implementation.
