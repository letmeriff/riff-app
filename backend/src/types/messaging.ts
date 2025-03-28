/**
 * Messaging Types
 * 
 * This module provides standardized type definitions for the messaging
 * architecture in the backend. It includes interfaces for network
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
  messageId?: number;
  attachmentId?: number;
  userId?: string;
}

/**
 * User presence information interface
 */
export interface UserPresence {
  userId: string;
  email: string;
  isTyping: boolean;
  lastActive: string; // ISO timestamp
}

/**
 * Chat message interface
 */
export interface ChatMessage {
  message_id: number;
  node_id: NodeId;
  content: string;
  is_user: boolean;
  timestamp: string;
  user_id?: string;
  email?: string;
}

/**
 * Chat attachment interface
 */
export interface ChatAttachment {
  attachment_id: number;
  node_id: NodeId;
  file_url: string;
  file_type: string;
  file_name: string;
  file_size: number;
  created_at: string;
  user_id?: string;
}

/**
 * Message update payload interface
 */
export interface MessageUpdatePayload extends NetworkPayload, EntityIds {
  new: {
    node_id: NodeId;
    message_id: number;
    content: string;
    is_user: boolean;
    timestamp: string;
    user_id?: string;
    email?: string;
  };
}

/**
 * Presence update payload interface
 */
export interface PresenceUpdatePayload extends NetworkPayload, EntityIds {
  presence: UserPresence[];
}

/**
 * Ownership update payload interface
 */
export interface OwnershipUpdatePayload extends NetworkPayload, EntityIds {
  ownerId: string;
}

/**
 * Transfer error payload interface
 */
export interface TransferErrorPayload extends NetworkPayload, EntityIds {
  error: string;
}

/**
 * Node update payload interface
 */
export interface NodeUpdatePayload extends NetworkPayload, EntityIds {
  new: {
    node_id: NodeId;
    title?: string;
    description?: string;
    owner_id?: string;
    [key: string]: unknown;
  };
}

/**
 * Attachment update payload interface
 */
export interface AttachmentUpdatePayload extends NetworkPayload, EntityIds {
  attachment: ChatAttachment;
}

/**
 * Attachment delete payload interface
 */
export interface AttachmentDeletePayload extends NetworkPayload, EntityIds {
  attachmentId: number;
}

/**
 * Factory function to create standardized message update payload
 */
export function createMessageUpdatePayload(message: ChatMessage): MessageUpdatePayload {
  return {
    nodeId: message.node_id,
    messageId: message.message_id,
    new: {
      node_id: message.node_id,
      message_id: message.message_id,
      content: message.content,
      is_user: message.is_user,
      timestamp: message.timestamp,
      user_id: message.user_id,
      email: message.email
    }
  };
}

/**
 * Factory function to create standardized presence update payload
 */
export function createPresenceUpdatePayload(nodeId: NodeId, presence: UserPresence[]): PresenceUpdatePayload {
  return {
    nodeId,
    presence
  };
}

/**
 * Factory function to create standardized ownership update payload
 */
export function createOwnershipUpdatePayload(nodeId: NodeId, ownerId: string): OwnershipUpdatePayload {
  return {
    nodeId,
    ownerId
  };
}

/**
 * Factory function to create standardized transfer error payload
 */
export function createTransferErrorPayload(nodeId: NodeId, error: string): TransferErrorPayload {
  return {
    nodeId,
    error
  };
}

/**
 * Factory function to create standardized node update payload
 */
export function createNodeUpdatePayload(node: { node_id: NodeId; [key: string]: unknown }): NodeUpdatePayload {
  return {
    nodeId: node.node_id,
    new: node
  };
}

/**
 * Factory function to create standardized attachment update payload
 */
export function createAttachmentUpdatePayload(attachment: ChatAttachment): AttachmentUpdatePayload {
  return {
    nodeId: attachment.node_id,
    attachmentId: attachment.attachment_id,
    attachment
  };
}

/**
 * Factory function to create standardized attachment delete payload
 */
export function createAttachmentDeletePayload(nodeId: NodeId, attachmentId: number): AttachmentDeletePayload {
  return {
    nodeId,
    attachmentId
  };
} 