# Yjs Implementation Usage Guide

## Overview

This document provides instructions on how to use the Yjs implementation for real-time collaboration features in the application. The implementation replaces the custom CRDT system with Yjs for better performance, robustness, and additional collaboration features.

## Feature Flags

The implementation uses feature flags to enable gradual transition from the legacy CRDT system to Yjs:

- `REACT_APP_USE_YJS` - Master feature flag for enabling Yjs (default: `true`)
- `REACT_APP_USE_YJS_POSITIONS` - Enables Yjs for node position synchronization (default: `true`)
- `REACT_APP_USE_YJS_NETWORK` - Uses Yjs awareness for network communication (default: `true`)

## Setting Up for Development

### 1. Database Setup

To set up the database for Yjs:

```bash
# Apply the Yjs migrations
cd backend
npm run yjs-migration
```

This will create the required tables:

- `yjs_documents` - Stores document snapshots
- `yjs_updates` - Stores incremental updates

### 2. Starting the WebSocket Server

The Yjs WebSocket server is integrated with the main Express server and starts automatically when the backend is running:

```bash
# Start the backend
cd backend
npm run dev
```

### 3. Frontend Integration

The frontend automatically uses Yjs when the feature flags are enabled:

```bash
# Start the frontend
cd frontend
npm run dev
```

## Using the Yjs Functionality

### Position Management

Node positions are automatically synchronized using Yjs. No special action is required if the feature flag is enabled.

### Offline Support

Yjs provides offline editing capabilities through IndexedDB:

1. When a user goes offline, changes are stored locally
2. Upon reconnection, changes are synchronized with the server
3. Any conflicts are automatically resolved using Yjs's CRDT algorithm

### Collaboration Features

The implementation includes several collaboration awareness features:

1. **User Cursors** - Shows the position of other users' cursors on the canvas
2. **Edit Indicators** - Highlights nodes being edited by other users
3. **Presence Awareness** - Shows which users are currently online

## Adapter Pattern

The implementation uses the adapter pattern to maintain compatibility with the existing system:

1. `positionAdapter.ts` - Interface for position management
2. `yjsPositionAdapter.ts` - Yjs implementation
3. `crdtPositionAdapter.ts` - Legacy CRDT implementation
4. `networkAdapter.ts` - Unified interface for network communication

## Database Maintenance

The system includes automatic database maintenance:

1. Periodic snapshots are created to manage document size
2. Old updates are pruned after snapshots
3. Scheduled maintenance runs every 24 hours to optimize storage

## Troubleshooting

### Connection Issues

If you experience connection issues:

1. Check that the WebSocket server is running
2. Verify that authentication is working (check the server logs)
3. Try clearing the IndexedDB cache in the browser

### Data Consistency Issues

If you notice data inconsistency:

1. Check the console for sync errors
2. Verify the document version in the database
3. Try recreating the document snapshot using the maintenance functions

## Performance Optimization

For large canvases, consider using:

1. Document chunking (enabled by default)
2. Selective loading based on viewport visibility
3. Throttled position updates for smoother performance
