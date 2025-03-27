# Yjs Dependencies Documentation

This document tracks the dependencies required for the Yjs implementation and their status.

## Core Dependencies

### Frontend Dependencies

| Dependency  | Version | Status       | Purpose                                        |
| ----------- | ------- | ------------ | ---------------------------------------------- |
| yjs         | 13.6.24 | ✅ Installed | Core CRDT implementation                       |
| y-websocket | 2.1.0   | ✅ Installed | WebSocket provider for network sync            |
| y-indexeddb | 9.0.12  | ✅ Installed | IndexedDB provider for client-side persistence |

### Backend Dependencies

| Dependency  | Version | Status       | Purpose                      |
| ----------- | ------- | ------------ | ---------------------------- |
| yjs         | 13.6.24 | ✅ Installed | Core CRDT implementation     |
| y-protocols | 1.0.6   | ✅ Installed | Sync and awareness protocols |
| lib0        | 0.2.88  | ✅ Installed | Utility library used by Yjs  |
| ws          | 8.16.0  | ✅ Installed | WebSocket implementation     |

## Optional/Additional Dependencies

| Dependency    | Status       | Purpose                 | Notes                                             |
| ------------- | ------------ | ----------------------- | ------------------------------------------------- |
| y-webrtc      | Not required | WebRTC provider         | Not needed as we're using WebSockets              |
| y-prosemirror | Not required | ProseMirror integration | Not relevant for our ReactFlow integration        |
| y-codemirror  | Not required | CodeMirror integration  | Not relevant for our ReactFlow integration        |
| y-redis       | Not required | Redis provider          | Can be considered for future multi-server scaling |

## Development Dependencies

| Dependency  | Status           | Purpose                   | Notes                                                                          |
| ----------- | ---------------- | ------------------------- | ------------------------------------------------------------------------------ |
| @types/yjs  | ❌ Not available | TypeScript types for Yjs  | Official @types package does not exist. Yjs includes its own type definitions. |
| @types/lib0 | ❌ Not required  | TypeScript types for lib0 | lib0 includes its own type definitions.                                        |

## Compatibility Notes

- **yjs**: ✅ Versions between backend and frontend are now aligned to 13.6.24.
- **TypeScript Types**: Yjs and related libraries include their own TypeScript definitions, so separate @types packages are not needed.

## Implementation Notes

1. Discovered that separate `@types/yjs` package does not exist. The Yjs library includes its own TypeScript definitions.

2. Successfully aligned Yjs versions between frontend and backend:

   ```
   npm install yjs@13.6.24 --workspace=backend
   ```

3. Verified that backend now uses the same version as frontend (13.6.24).

## Action Items

- [x] Verify core dependencies are installed
- [x] Check TypeScript type definitions (found to be included in the packages)
- [x] Align Yjs versions between frontend and backend
- [ ] Update package.json documentation to note Yjs dependency requirements

## Additional Recommendations

1. Consider documenting required Yjs packages in the project README for future developers.

2. Add a note in the package.json files about version alignment requirements:
   ```json
   "comments": {
     "dependencies": {
       "yjs": "Must be kept in sync between frontend and backend"
     }
   }
   ```

This documentation has been updated to reflect the current state of dependencies for the Yjs implementation.
