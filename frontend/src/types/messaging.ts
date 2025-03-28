/**
 * Messaging Types
 *
 * This module provides standardized type definitions for the messaging
 * architecture in the application. It includes interfaces for network
 * payloads, entity IDs, and specific message types.
 */

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
  messageId?: number | string;
  attachmentId?: number | string;
  userId?: string;
}

// Interface for user presence information
export interface UserPresence {
  userId: string;
  email: string;
  isTyping: boolean;
  lastActive: string;
}

// Interface for chat message
export interface ChatMessage {
  message_id: string | number;
  node_id?: number;
  content: string;
  is_user: boolean;
  timestamp: string;
  user_id?: string;
  email?: string;
}

// Interface for chat attachment
export interface ChatAttachment {
  attachment_id: number | string;
  file_url: string;
  file_type: string;
  file_name?: string;
  file_size?: number | string;
  created_at?: string;
  user_id?: string;
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
  attachmentId: string | number;
}
