import { Socket } from 'socket.io-client';
import { WebsocketProvider } from 'y-websocket';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';

// Define payload types for better type safety
export interface NetworkPayload {
  [key: string]: unknown;
}

// Define callback types
export type PayloadCallback = (payload: NetworkPayload) => void;

export interface NetworkAdapter {
  connect(): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  sendMessage(eventName: string, payload: NetworkPayload): void;
  subscribeToEvent(eventName: string, callback: PayloadCallback): () => void;
  updateUserPresence(nodeId: string, isTyping: boolean): void;
  setUserCursor(position: { x: number, y: number } | null): void;
}

// Feature flag to determine which network implementation to use
export const isYjsNetworkEnabled = (): boolean => {
  // Yjs is now the only implementation
  return true;
};

// Socket.IO implementation of the network adapter
export class SocketIONetworkAdapter implements NetworkAdapter {
  private socket: Socket | null = null;
  private callbacks: Map<string, Set<PayloadCallback>> = new Map();
  
  constructor(socket: Socket | null) {
    this.socket = socket;
  }
  
  async connect(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.socket) {
        resolve(false);
        return;
      }
      
      if (this.socket.connected) {
        resolve(true);
        return;
      }
      
      const onConnect = () => {
        this.socket?.off('connect', onConnect);
        resolve(true);
      };
      
      this.socket.on('connect', onConnect);
      
      // Give it a reasonable timeout
      setTimeout(() => {
        if (!this.socket?.connected) {
          this.socket?.off('connect', onConnect);
          resolve(false);
        }
      }, 5000);
    });
  }
  
  disconnect(): void {
    if (this.socket) {
      // Remove all event listeners
      for (const eventName of Array.from(this.callbacks.keys())) {
        this.socket.off(eventName);
      }
      this.callbacks.clear();
    }
  }
  
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  sendMessage(eventName: string, payload: NetworkPayload): void {
    if (this.socket?.connected) {
      this.socket.emit(eventName, payload);
    } else {
      console.warn(`Cannot send message ${eventName} while disconnected`);
    }
  }
  
  subscribeToEvent(eventName: string, callback: PayloadCallback): () => void {
    if (!this.socket) {
      console.warn(`Cannot subscribe to ${eventName} without a socket`);
      return () => {};
    }
    
    // Add callback to our tracking
    if (!this.callbacks.has(eventName)) {
      this.callbacks.set(eventName, new Set());
    }
    this.callbacks.get(eventName)?.add(callback);
    
    // Add the actual socket.io listener
    this.socket.on(eventName, callback as (payload: unknown) => void);
    
    // Return unsubscribe function
    return () => {
      this.socket?.off(eventName, callback as (payload: unknown) => void);
      this.callbacks.get(eventName)?.delete(callback);
    };
  }
  
  updateUserPresence(nodeId: string, isTyping: boolean): void {
    this.sendMessage('update-typing', { nodeId, isTyping });
  }
  
  setUserCursor(position: { x: number, y: number } | null): void {
    // Socket.IO doesn't have built-in cursor tracking
    // This would typically be implemented with a custom event
    this.sendMessage('cursor-update', { position });
  }
}

// Define awareness state types
interface AwarenessState {
  userId?: string;
  user?: { id: string; [key: string]: unknown };
  events?: Record<string, { payload: NetworkPayload; timestamp: number }>;
  presence?: { nodeId?: string; isTyping?: boolean; [key: string]: unknown };
  cursor?: { x: number; y: number } | null;
  [key: string]: unknown;
}

// Yjs implementation of the network adapter
export class YjsNetworkAdapter implements NetworkAdapter {
  private wsProvider: WebsocketProvider | null = null;
  private awareness: awarenessProtocol.Awareness | null = null;
  private doc: Y.Doc | null = null;
  private userId: string;
  private eventEmitters: Map<string, Set<PayloadCallback>> = new Map();
  
  constructor(wsProvider: WebsocketProvider | null, doc: Y.Doc | null, userId: string) {
    this.wsProvider = wsProvider;
    this.doc = doc;
    this.userId = userId;
    this.awareness = wsProvider?.awareness || null;
    
    // Set up awareness changes to map to our events
    if (this.awareness) {
      this.awareness.on('change', this.handleAwarenessChange.bind(this));
    }
  }
  
  async connect(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.wsProvider) {
        resolve(false);
        return;
      }
      
      const checkConnection = () => {
        if (this.wsProvider?.wsconnected) {
          this.wsProvider.off('status', statusHandler);
          resolve(true);
        }
      };
      
      const statusHandler = ({ status }: { status: string }) => {
        if (status === 'connected') {
          this.wsProvider?.off('status', statusHandler);
          resolve(true);
        }
      };
      
      // Check if already connected
      if (this.wsProvider.wsconnected) {
        resolve(true);
        return;
      }
      
      // Listen for connection status
      this.wsProvider.on('status', statusHandler);
      
      // Give it a reasonable timeout
      setTimeout(() => {
        checkConnection();
        this.wsProvider?.off('status', statusHandler);
        resolve(false);
      }, 5000);
    });
  }
  
  disconnect(): void {
    if (this.wsProvider) {
      this.wsProvider.disconnect();
    }
  }
  
  isConnected(): boolean {
    return this.wsProvider?.wsconnected || false;
  }
  
  // This maps traditional events to Yjs awareness updates
  sendMessage(eventName: string, payload: NetworkPayload): void {
    if (!this.awareness || !this.wsProvider?.wsconnected) {
      console.warn(`Cannot send message ${eventName} while disconnected`);
      return;
    }
    
    // Get current state
    const currentState = this.awareness.getLocalState() as AwarenessState || {};
    
    // Update with the new event
    const newState: AwarenessState = {
      ...currentState,
      userId: this.userId,
      user: { id: this.userId },
      events: {
        ...(currentState.events || {}),
        [eventName]: {
          payload,
          timestamp: Date.now()
        }
      }
    };
    
    // Set the awareness state
    this.awareness.setLocalState(newState);
  }
  
  // This maps Yjs awareness changes to traditional event callbacks
  subscribeToEvent(eventName: string, callback: PayloadCallback): () => void {
    // Add callback to our tracking
    if (!this.eventEmitters.has(eventName)) {
      this.eventEmitters.set(eventName, new Set());
    }
    this.eventEmitters.get(eventName)?.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.eventEmitters.get(eventName)?.delete(callback);
    };
  }
  
  // Handle awareness changes and emit corresponding events
  private handleAwarenessChange(_changes: unknown): void {
    const awareness = this.awareness;
    if (!awareness) return;
    
    // Get all awareness states to extract changes
    const awarenessStates = awareness.getStates();
    
    // Process each client in awareness states
    awarenessStates.forEach((state: AwarenessState, clientId: number) => {
      // Skip our own changes
      if (clientId === this.doc?.clientID) return;
      
      if (state && state.events) {
        // Process each event in the state
        Object.entries(state.events).forEach(([eventName, eventData]) => {
          // Notify all registered callbacks for this event
          const callbacks = this.eventEmitters.get(eventName);
          if (callbacks) {
            const data = eventData.payload;
            callbacks.forEach(callback => callback(data));
          }
        });
      }
    });
  }
  
  // Update user typing status through awareness
  updateUserPresence(nodeId: string, isTyping: boolean): void {
    if (!this.awareness) return;
    
    const state = this.awareness.getLocalState() as AwarenessState || {};
    const newState: AwarenessState = {
      ...state,
      userId: this.userId,
      user: { id: this.userId },
      presence: {
        ...(state.presence || {}),
        nodeId,
        isTyping
      }
    };
    
    this.awareness.setLocalState(newState);
  }
  
  // Update cursor position through awareness
  setUserCursor(position: { x: number, y: number } | null): void {
    if (!this.awareness) return;
    
    const state = this.awareness.getLocalState() as AwarenessState || {};
    const newState: AwarenessState = {
      ...state,
      userId: this.userId,
      user: { id: this.userId },
      cursor: position
    };
    
    this.awareness.setLocalState(newState);
  }
}

// Factory function to create the appropriate network adapter
export const createNetworkAdapter = (
  socket: Socket | null,
  wsProvider: WebsocketProvider | null,
  doc: Y.Doc | null,
  userId: string
): NetworkAdapter => {
  if (isYjsNetworkEnabled() && wsProvider && doc) {
    console.log('Using Yjs network adapter');
    return new YjsNetworkAdapter(wsProvider, doc, userId);
  } else {
    console.log('Using Socket.IO network adapter');
    return new SocketIONetworkAdapter(socket);
  }
}; 