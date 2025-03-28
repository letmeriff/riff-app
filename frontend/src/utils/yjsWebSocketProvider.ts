/**
 * Yjs WebSocket Provider Utility
 * 
 * This module provides utilities for managing Yjs WebSocket connections with
 * enhanced features for connection status tracking, authentication, and reconnection.
 * 
 * References: 
 * - REQ-303 WebSocket Provider
 * - REQ-303.1 Connection Lifecycle
 * - REQ-303.2 Message Handling
 * - REQ-303.3 Authentication
 * - REQ-303.4 Reconnection Behavior
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Keep track of the active provider
let activeProvider: WebsocketProvider | null = null;

// Keep track of the current connection status
let connectionStatus: string = 'disconnected';

// Authentication parameters
let authParams: Record<string, any> = {};

// Reconnection settings
let backoffTime: number = 1000; // Initial backoff time in ms
let maxBackoffTime: number = 30000; // Maximum backoff time in ms
let backoffFactor: number = 2; // Exponential backoff factor
let currentBackoffTime: number = backoffTime;

/**
 * Connection options for WebSocket provider
 */
export interface ConnectionOptions {
  initialBackoffTime?: number;
  maxBackoffTime?: number;
  backoffFactor?: number;
}

/**
 * Initialize and set up a WebSocket provider for Yjs
 * 
 * @param doc The Yjs document
 * @param url WebSocket server URL
 * @param roomName Room/document identifier
 * @param params Authentication parameters (token, etc.)
 * @param options Connection options
 * @returns The WebSocket provider instance
 */
export function setupYjsWebSocketProvider(
  doc: Y.Doc,
  url: string,
  roomName: string,
  params: Record<string, any> = {},
  options: ConnectionOptions = {}
): WebsocketProvider {
  // Clean up any existing provider
  if (activeProvider) {
    activeProvider.disconnect();
    activeProvider = null;
  }
  
  // Store auth params for reconnection
  authParams = { ...params };
  
  // Initialize connection options
  backoffTime = options.initialBackoffTime || 1000;
  maxBackoffTime = options.maxBackoffTime || 30000;
  backoffFactor = options.backoffFactor || 2;
  currentBackoffTime = backoffTime;
  
  // Create new provider
  activeProvider = new WebsocketProvider(url, roomName, doc, {
    connect: true,
    params: authParams,
  });
  
  // Set up status tracking
  activeProvider.on('status', ({ status }: { status: string }) => {
    connectionStatus = status;
    
    // Reset backoff time on successful connection
    if (status === 'connected') {
      currentBackoffTime = backoffTime;
    }
    
    // Log connection status changes
    console.log(`WebSocket connection status: ${status}`);
  });
  
  return activeProvider;
}

/**
 * Get the current connection status
 * 
 * @returns Current connection status ('connected', 'connecting', 'disconnected')
 */
export function getConnectionStatus(): string {
  return connectionStatus;
}

/**
 * Get the current authentication parameters
 * 
 * @returns Authentication parameters object
 */
export function getAuthParams(): Record<string, any> {
  return { ...authParams };
}

/**
 * Attempt to reconnect to the WebSocket server
 * Uses exponential backoff for repeated reconnection attempts
 */
export function reconnect(): void {
  if (!activeProvider) {
    console.warn('No active WebSocket provider to reconnect');
    return;
  }
  
  // Set a timeout based on current backoff time
  setTimeout(() => {
    console.log(`Attempting to reconnect (backoff: ${currentBackoffTime}ms)`);
    activeProvider?.connect();
    
    // Increase backoff time for next attempt
    currentBackoffTime = Math.min(currentBackoffTime * backoffFactor, maxBackoffTime);
  }, 0);
}

/**
 * Disconnect from the WebSocket server
 */
export function disconnect(): void {
  if (!activeProvider) {
    console.warn('No active WebSocket provider to disconnect');
    return;
  }
  
  activeProvider.disconnect();
  connectionStatus = 'disconnected';
}

/**
 * Broadcast a custom message through the WebSocket connection
 * 
 * @param messageType Message type identifier
 * @param messageData Message data payload
 */
export function broadcastMessage(messageType: string, messageData: any): void {
  if (!activeProvider) {
    console.warn('No active WebSocket provider to broadcast message');
    return;
  }
  
  // Use the awareness protocol to broadcast custom messages
  // This is a workaround since y-websocket doesn't provide a direct broadcast API
  const customMessage = {
    type: messageType,
    data: messageData,
    from: activeProvider.awareness.getLocalState()?.clientID || 'unknown'
  };
  
  // We need to use any here because broadcastMessage is not in the public types
  (activeProvider as any).broadcastMessage(messageType, customMessage);
}

/**
 * Register a handler for custom messages
 * 
 * @param messageType Message type to listen for
 * @param handler Handler function
 */
export function onMessage(messageType: string, handler: (data: any) => void): void {
  if (!activeProvider) {
    console.warn('No active WebSocket provider to register message handler');
    return;
  }
  
  // We need to use any here because 'message' event is not in the public types
  (activeProvider as any).on('message', (msg: { type: string, data: any }) => {
    if (msg.type === messageType) {
      handler(msg.data);
    }
  });
}

/**
 * Check if WebSocket is currently connected
 * 
 * @returns boolean indicating if connected
 */
export function isConnected(): boolean {
  if (!activeProvider) return false;
  
  return (activeProvider as any).wsconnected === true;
}

/**
 * Clean up WebSocket provider resources
 */
export function cleanup(): void {
  if (activeProvider) {
    activeProvider.disconnect();
    activeProvider = null;
  }
  
  connectionStatus = 'disconnected';
  authParams = {};
} 