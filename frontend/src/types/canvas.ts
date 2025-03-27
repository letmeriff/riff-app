/**
 * Canvas Types
 * 
 * This file contains all type definitions related to the Canvas component system.
 * These types represent the core data structures and interfaces used across
 * the Canvas components and hooks.
 */

import { Node, Edge, XYPosition, NodeChange, EdgeChange, Connection, OnNodesChange, OnEdgesChange, NodeDragHandler, NodeMouseHandler } from 'reactflow';

// ---------------------------------------------------------------------------
// Core Data Types
// ---------------------------------------------------------------------------

/**
 * Canvas Node - Extension of ReactFlow Node with additional properties
 */
export type CanvasNode = Node<CanvasNodeData>;

/**
 * Canvas Node Data - Specific data attached to canvas nodes
 */
export interface CanvasNodeData {
  content: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  isEditing?: boolean;
  isPulling?: boolean;
  isSaving?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  pulledConnections?: PulledConnection[];
  pulledByConnections?: PulledByConnection[];
  userPresence?: UserPresence[];
  attachments?: NodeAttachment[];
  onDeleteNode?: (nodeId: string) => void;
  onContentChange?: (nodeId: string, content: string) => void;
  onStartEditing?: (nodeId: string) => void;
  onStopEditing?: (nodeId: string) => void;
}

/**
 * Canvas Edge - Extension of ReactFlow Edge with additional properties
 */
export type CanvasEdge = Edge<CanvasEdgeData>;

/**
 * Canvas Edge Data - Specific data attached to canvas edges
 */
export interface CanvasEdgeData {
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  type?: 'standard' | 'context-pull';
  isPulling?: boolean;
  lastPulledAt?: string;
}

/**
 * Context Pull Connection between nodes
 */
export interface PulledConnection {
  nodeId: string;
  hasUpdates: boolean;
  pullId: number;
}

/**
 * Context Pull By Connection (nodes pulling from this node)
 */
export interface PulledByConnection {
  nodeId: string;
  pullId: number;
}

/**
 * User information for displaying presence on nodes
 */
export interface UserPresence {
  userId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  color?: string;
  isTyping: boolean;
  lastActive: string;
}

/**
 * File attachment for a node
 */
export interface NodeAttachment {
  attachment_id: number;
  file_url: string;
  file_type: string;
  file_name?: string;
  file_size?: number;
}

/**
 * Position type with optional zoom
 */
export interface CanvasPosition extends XYPosition {
  zoom?: number;
}

/**
 * Viewport bounds for optimization
 */
export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  zoom: number;
}

// ---------------------------------------------------------------------------
// Component Props Interfaces
// ---------------------------------------------------------------------------

/**
 * Props for the main CanvasPage container component
 */
export interface CanvasPageProps {
  onNodeSelect: (nodeId: string | null, nodeTitle: string | null) => void;
  onOpenSettings?: () => void;
}

/**
 * Props for the Canvas component (ReactFlow wrapper)
 */
export interface CanvasProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeClick?: NodeMouseHandler;
  onNodeDragStop?: NodeDragHandler;
  onSelectionChange?: (elements: { nodes: Node[]; edges: Edge[] }) => void;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
  isOfflineMode?: boolean;
  readOnly?: boolean;
  children?: React.ReactNode;
}

/**
 * Props for the FloatingMenu component
 */
export interface FloatingMenuProps {
  onCreateNode: () => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  disabled?: boolean;
}

/**
 * Props for the ChatNode component
 */
export interface ChatNodeProps {
  id: string;
  data: CanvasNodeData;
  selected?: boolean;
  isDragging?: boolean;
}

/**
 * Props for the CollaborationStatus component
 */
export interface CollaborationStatusProps {
  isConnected: boolean;
  isOffline: boolean;
  offlineChangesCount: number;
  connectedUsers: UserPresence[];
  onSyncNow?: () => void;
}

/**
 * Props for the UserCursors component
 */
export interface UserCursorsProps {
  users: {
    id: string;
    name?: string;
    color: string;
    position: XYPosition;
  }[];
}

// ---------------------------------------------------------------------------
// Hook Return Types
// ---------------------------------------------------------------------------

/**
 * Return type for useCanvasNodes hook
 */
export interface UseCanvasNodesResult {
  nodes: CanvasNode[];
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  onNodesChange: OnNodesChange;
  createNode: (position?: XYPosition) => Promise<CanvasNode | null>;
  updateNodeContent: (nodeId: string, content: string) => void;
  updateNodePosition: (nodeId: string, position: XYPosition) => void;
  deleteNode: (nodeId: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
}

/**
 * Return type for useCanvasEdges hook
 */
export interface UseCanvasEdgesResult {
  edges: CanvasEdge[];
  setEdges: React.Dispatch<React.SetStateAction<CanvasEdge[]>>;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  createEdge: (source: string, target: string, data?: CanvasEdgeData) => CanvasEdge | null;
  deleteEdge: (edgeId: string) => boolean;
  loading: boolean;
  error: Error | null;
}

/**
 * Return type for useYjsIntegration hook
 */
export interface UseYjsIntegrationResult {
  isConnected: boolean;
  isOffline: boolean;
  offlineChangesCount: number;
  syncStatus: string | null;
  connectedUsers: UserPresence[];
  forceSync: () => Promise<boolean>;
  updateAwareness: (data: any) => void;
}

/**
 * Return type for useCanvasUI hook
 */
export interface UseCanvasUIResult {
  selectedNodeId: string | null;
  setSelectedNodeId: (nodeId: string | null) => void;
  selectedNodeContent: string | null;
  setSelectedNodeContent: (content: string | null) => void;
  viewport: ViewportBounds | null;
  setViewport: (viewport: ViewportBounds) => void;
  isMenuOpen: boolean;
  toggleMenu: () => void;
}

// ---------------------------------------------------------------------------
// Service Types
// ---------------------------------------------------------------------------

/**
 * Database node type coming from API/Supabase
 */
export interface DbNode {
  node_id: string | number;
  content: string;
  position_x?: number;
  position_y?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

/**
 * Database edge type coming from API/Supabase
 */
export interface DbEdge {
  edge_id: string | number;
  source_id: string | number;
  target_id: string | number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  edge_type?: string;
}

/**
 * Type for payload sent to Supabase
 */
export interface SupabasePayload {
  [key: string]: any;
} 