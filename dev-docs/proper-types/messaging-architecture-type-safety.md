# Messaging Architecture Type Safety Implementation Plan

This document outlines a comprehensive implementation plan to improve type safety throughout the messaging architecture in our application. It addresses the issues we've encountered with inconsistent type handling, particularly around network payloads and entity IDs.

## Current Issues

- Inconsistent types for entity IDs (number vs string)
- Missing or inadequate type definitions for network payloads
- Unsafe type assertions and comparisons in components
- Lack of validation at API boundaries

## Implementation Plan

### 1. Create a Centralized Type Definition Module

```typescript
// src/types/messaging.ts

/**
 * Base network payload type that all payloads extend
 */
export interface NetworkPayload {
  [key: string]: unknown;
}

/**
 * Standardized node ID type (consistent across the application)
 */
export type NodeId = number;

/**
 * Base interface for all entity IDs
 */
export interface EntityIds {
  nodeId: NodeId;
  messageId?: number;
  attachmentId?: number;
  userId?: string;
}

/**
 * Core message payload interfaces
 */
export interface MessageUpdatePayload extends NetworkPayload, EntityIds {
  new?: {
    node_id: NodeId;
    message_id: string | number;
    content: string;
    is_user: boolean;
    timestamp: string;
    [key: string]: unknown;
  };
}

export interface PresenceUpdatePayload extends NetworkPayload, EntityIds {
  presence: UserPresence[];
}

export interface OwnershipUpdatePayload extends NetworkPayload, EntityIds {
  ownerId: string;
}

export interface TransferErrorPayload extends NetworkPayload, EntityIds {
  error: string;
}

export interface NodeUpdatePayload extends NetworkPayload, EntityIds {
  new?: {
    node_id: NodeId;
    [key: string]: unknown;
  };
}

export interface AttachmentUpdatePayload extends NetworkPayload, EntityIds {
  attachment: ChatAttachment;
}

export interface AttachmentDeletePayload extends NetworkPayload, EntityIds {
  attachmentId: string;
}
```

### 2. Create Type Guards and Converters

```typescript
// src/utils/typeGuards.ts

import { NodeId, MessageUpdatePayload, PresenceUpdatePayload, OwnershipUpdatePayload, NetworkPayload } from '../types/messaging';

/**
 * Type guard to check if payload matches expected interface
 */
export function isMessageUpdatePayload(payload: NetworkPayload): payload is MessageUpdatePayload {
  return payload.new !== undefined && 
         typeof payload.new === 'object' && 
         'node_id' in payload.new;
}

export function isPresenceUpdatePayload(payload: NetworkPayload): payload is PresenceUpdatePayload {
  return 'nodeId' in payload && 
         Array.isArray(payload.presence);
}

export function isOwnershipUpdatePayload(payload: NetworkPayload): payload is OwnershipUpdatePayload {
  return 'nodeId' in payload && 
         'ownerId' in payload;
}

// Add type guards for other payload types...

/**
 * Safely convert string node ID to number
 */
export function parseNodeId(nodeId: string | null): NodeId | null {
  if (nodeId === null) return null;
  const parsed = parseInt(nodeId, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Compare NodeId with string safely
 */
export function compareNodeIds(numericId: NodeId, stringId: string | null): boolean {
  if (stringId === null) return false;
  return numericId === parseInt(stringId, 10);
}
```

### 3. Create API Boundary Validation

```typescript
// src/services/networkService.ts

import { NetworkPayload } from '../types/messaging';
import { isMessageUpdatePayload, isPresenceUpdatePayload } from '../utils/typeGuards';

/**
 * Validate incoming network payload before processing
 */
export function validatePayload<T extends NetworkPayload>(
  payload: unknown,
  typeGuard: (payload: NetworkPayload) => payload is T
): T | null {
  if (!payload || typeof payload !== 'object') {
    console.error('Invalid payload received:', payload);
    return null;
  }
  
  if (!typeGuard(payload as NetworkPayload)) {
    console.error('Payload failed type validation:', payload);
    return null;
  }
  
  return payload;
}
```

### 4. Update Network Context Hooks for Type Safety

```typescript
// src/contexts/NetworkContext.tsx

import { NetworkPayload, MessageUpdatePayload, PresenceUpdatePayload } from '../types/messaging';
import { validatePayload } from '../services/networkService';
import { isMessageUpdatePayload, isPresenceUpdatePayload } from '../utils/typeGuards';

// Type-safe wrapper for subscribeToEvent
export function useTypedEvent<T extends NetworkPayload>(
  eventName: string,
  typeGuard: (payload: NetworkPayload) => payload is T,
  callback: (payload: T) => void
): () => void {
  const { subscribeToEvent } = useNetwork();
  
  return useCallback(() => {
    return subscribeToEvent(eventName, (rawPayload) => {
      const validPayload = validatePayload(rawPayload, typeGuard);
      if (validPayload) {
        callback(validPayload);
      }
    });
  }, [eventName, subscribeToEvent]);
}

// Example of specific typed event hooks
export function useMessageUpdateEvent(callback: (payload: MessageUpdatePayload) => void): () => void {
  return useTypedEvent('message-update', isMessageUpdatePayload, callback);
}

export function usePresenceUpdateEvent(callback: (payload: PresenceUpdatePayload) => void): () => void {
  return useTypedEvent('presence-update', isPresenceUpdatePayload, callback);
}

// Add hooks for other event types...
```

### 5. Refactor ChatUI Component

```typescript
// In ChatUI.tsx

import { 
  MessageUpdatePayload, 
  PresenceUpdatePayload,
  NodeId 
} from '../types/messaging';
import { 
  parseNodeId, 
  compareNodeIds,
  isMessageUpdatePayload
} from '../utils/typeGuards';
import { validatePayload } from '../services/networkService';
import { 
  useMessageUpdateEvent, 
  usePresenceUpdateEvent,
  useOwnershipUpdateEvent 
} from '../contexts/NetworkContext';

const ChatUI: React.FC<ChatUIProps> = ({ nodeId, nodeTitle, userId }) => {
  const parsedNodeId = parseNodeId(nodeId);
  
  // Use the type-safe hook instead of raw subscribeToEvent
  const messageUpdateCallback = useCallback((payload: MessageUpdatePayload) => {
    if (payload.new && parsedNodeId && compareNodeIds(payload.new.node_id, nodeId)) {
      setMessages((prev) => {
        // Now we have proper type safety
        if (!payload.new || prev.some(msg => msg.message_id === payload.new.message_id)) {
          return prev;
        }
        return [...prev, payload.new as ChatMessage];
      });
    }
  }, [nodeId, parsedNodeId]);
  
  const presenceUpdateCallback = useCallback((payload: PresenceUpdatePayload) => {
    if (parsedNodeId && compareNodeIds(payload.nodeId, nodeId)) {
      // Extract emails of users who are typing (excluding the current user)
      const typing = payload.presence
        .filter((p: UserPresence) => p.isTyping && p.userId !== userId)
        .map((p: UserPresence) => p.email);
      
      setTypingUsers(typing);
      setPresentUsers(payload.presence);
    }
  }, [nodeId, parsedNodeId, userId]);
  
  // Use the new hooks
  useEffect(() => {
    if (networkAdapter) {
      const unsubscribeMessage = useMessageUpdateEvent(messageUpdateCallback);
      const unsubscribePresence = usePresenceUpdateEvent(presenceUpdateCallback);
      
      // Return cleanup function
      return () => {
        unsubscribeMessage();
        unsubscribePresence();
      };
    }
  }, [networkAdapter, messageUpdateCallback, presenceUpdateCallback]);
  
  // Rest of component...
}
```

### 6. Update Backend API to Enforce Type Consistency

```typescript
// In server code (NodeJS/Express)

import { NodeId } from '../shared/types';

// Standardize payload format on the server side
function createMessageUpdatePayload(nodeId: NodeId, message: any) {
  return {
    nodeId,
    new: {
      node_id: nodeId, // Always use numbers for IDs
      message_id: message.id,
      content: message.content,
      timestamp: message.timestamp,
      is_user: message.is_user
    }
  };
}

app.post('/api/chat/:nodeId', async (req, res) => {
  const nodeId = parseInt(req.params.nodeId, 10);
  
  // Validate nodeId
  if (isNaN(nodeId)) {
    return res.status(400).json({ error: 'Invalid node ID' });
  }
  
  // Process message...
  
  // Emit properly typed payload
  io.to(`node-${nodeId}`).emit('message-update', createMessageUpdatePayload(nodeId, message));
  
  res.json({ success: true, message });
});
```

### 7. Migration Strategy

1. **Phase 1: Create Core Type Definitions**
   - Implement the centralized type definition package
   - Add type guards and converters
   - Create API boundary validation

2. **Phase 2: Update Backend**
   - Standardize ID handling in all API endpoints (always return numeric IDs)
   - Implement consistent payload structures for all websocket events
   - Add validation to ensure payloads match expected types

3. **Phase 3: Frontend Component Updates**
   - Update NetworkContext to provide type-safe hooks
   - Refactor components using the new type-safe hooks
   - Update UI components to parse IDs consistently

4. **Phase 4: Testing and Validation**
   - Add unit tests to validate type guards
   - Add integration tests for API boundaries
   - Test real-time messaging with different client configurations

## Benefits

- **Type Safety**: Eliminates runtime type errors related to payload handling
- **Cleaner Code**: Removes unsafe type assertions and comparisons
- **Self-Documenting**: Clear interfaces document the expected payload structure
- **Maintainability**: Makes the codebase more maintainable and easier to understand
- **Error Reduction**: Catches errors at compile time rather than runtime
- **Developer Experience**: Improves IDE autocompletion and type hints

## Next Steps

1. Implement the centralized type definition module
2. Create type guards and validate key payload types
3. Update NetworkContext with type-safe event hooks
4. Refactor one component (ChatUI) as a proof of concept
5. Gradually extend the approach to other components 