/**
 * Type Guards
 *
 * This module provides type guard functions and utilities for safely
 * handling data types and conversions throughout the application.
 */

import {
  NodeId,
  NetworkPayload,
  MessageUpdatePayload,
  PresenceUpdatePayload,
  OwnershipUpdatePayload,
  TransferErrorPayload,
  NodeUpdatePayload,
  AttachmentUpdatePayload,
  AttachmentDeletePayload,
} from '../types/messaging';

/**
 * Type guard to check if payload matches MessageUpdatePayload
 */
export function isMessageUpdatePayload(
  payload: NetworkPayload
): payload is MessageUpdatePayload {
  return (
    payload.new !== undefined &&
    payload.new !== null &&
    typeof payload.new === 'object' &&
    'node_id' in payload.new
  );
}

/**
 * Type guard to check if payload matches PresenceUpdatePayload
 */
export function isPresenceUpdatePayload(
  payload: NetworkPayload
): payload is PresenceUpdatePayload {
  return (
    'nodeId' in payload &&
    'presence' in payload &&
    Array.isArray(payload.presence)
  );
}

/**
 * Type guard to check if payload matches OwnershipUpdatePayload
 */
export function isOwnershipUpdatePayload(
  payload: NetworkPayload
): payload is OwnershipUpdatePayload {
  return 'nodeId' in payload && 'ownerId' in payload;
}

/**
 * Type guard to check if payload matches TransferErrorPayload
 */
export function isTransferErrorPayload(
  payload: NetworkPayload
): payload is TransferErrorPayload {
  return (
    'nodeId' in payload &&
    'error' in payload &&
    typeof payload.error === 'string'
  );
}

/**
 * Type guard to check if payload matches NodeUpdatePayload
 */
export function isNodeUpdatePayload(
  payload: NetworkPayload
): payload is NodeUpdatePayload {
  return (
    payload.new !== undefined &&
    payload.new !== null &&
    typeof payload.new === 'object' &&
    'node_id' in payload.new
  );
}

/**
 * Type guard to check if payload matches AttachmentUpdatePayload
 */
export function isAttachmentUpdatePayload(
  payload: NetworkPayload
): payload is AttachmentUpdatePayload {
  return (
    'nodeId' in payload &&
    'attachment' in payload &&
    typeof payload.attachment === 'object'
  );
}

/**
 * Type guard to check if payload matches AttachmentDeletePayload
 */
export function isAttachmentDeletePayload(
  payload: NetworkPayload
): payload is AttachmentDeletePayload {
  return 'nodeId' in payload && 'attachmentId' in payload;
}

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
export function compareNodeIds(
  numericId: NodeId,
  stringId: string | null
): boolean {
  if (stringId === null) return false;
  return numericId === parseInt(stringId, 10);
}

/**
 * Safely convert a potentially string ID to number
 */
export function ensureNumericId(id: string | number | null): number | null {
  if (id === null) return null;

  if (typeof id === 'number') return id;

  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? null : parsed;
}
