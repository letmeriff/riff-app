/**
 * Test file for collaborative editing functionality
 * 
 * Reference: REQ-401 Collaborative Editing
 * Tests focused on concurrent node operations, conflict handling, and synchronization
 * between multiple users editing the same document simultaneously.
 */

import * as Y from 'yjs';
import { Node, Edge } from 'reactflow';
import { createTestMultiUserEnvironment } from '../test-utils/multiUserTestHarness';
import { applyNodeUpdate, applyEdgeUpdate, resolveConflict } from './collaborativeEditing';

// Add this interface near the top of the file, outside any tests
interface ResolvedMetadata {
  created: string;
  updated: string;
  author: string;
}

// Mock Yjs and related dependencies
jest.mock('yjs', () => {
  // Helper to create a mock Y.Map
  const createMockMap = () => {
    const data = new Map<string, unknown>();
    return {
      set: jest.fn((key: string, value: unknown) => {
        data.set(key, value);
        return true;
      }),
      get: jest.fn((key: string) => data.get(key)),
      has: jest.fn((key: string) => data.has(key)),
      delete: jest.fn((key: string) => data.delete(key)),
      toJSON: jest.fn(() => {
        const obj: Record<string, unknown> = {};
        data.forEach((value, key) => {
          obj[key] = value;
        });
        return obj;
      })
    };
  };

  // Mock Doc implementation
  class MockDoc {
    clientID = Math.floor(Math.random() * 1000);
    private maps: Record<string, ReturnType<typeof createMockMap>> = {
      nodes: createMockMap(),
      edges: createMockMap(),
      metadata: createMockMap()
    };
    private eventHandlers: Record<string, Array<(...args: unknown[]) => void>> = {};

    getMap(name: string) {
      return this.maps[name] || createMockMap();
    }

    on(event: string, callback: (...args: unknown[]) => void) {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }
      this.eventHandlers[event].push(callback);
      return this;
    }

    off(event: string, callback?: (...args: unknown[]) => void) {
      if (!callback) {
        delete this.eventHandlers[event];
      } else if (this.eventHandlers[event]) {
        this.eventHandlers[event] = this.eventHandlers[event].filter(cb => cb !== callback);
      }
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      if (this.eventHandlers[event]) {
        this.eventHandlers[event].forEach(callback => callback(...args));
      }
      return this;
    }

    transact(fn: () => void) {
      fn();
      this.emit('update', [], this);
      return this;
    }
  }

  return {
    Doc: jest.fn().mockImplementation(() => new MockDoc()),
    Map: jest.fn().mockImplementation(createMockMap),
    Array: jest.fn().mockImplementation(() => ({
      push: jest.fn(),
      delete: jest.fn(),
      toArray: jest.fn().mockReturnValue([]),
    })),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    encodeStateVector: jest.fn().mockReturnValue(new Uint8Array([1, 2])),
  };
});

// Mock our test harness
jest.mock('../test-utils/multiUserTestHarness', () => {
  return {
    createTestMultiUserEnvironment: jest.fn().mockImplementation(() => {
      const mockDocs = [];
      const mockClients = [];

      for (let i = 0; i < 3; i++) {
        const doc = new Y.Doc();
        mockDocs.push(doc);

        mockClients.push({
          id: `user${i + 1}`,
          doc,
          getNode: jest.fn().mockImplementation((id) => ({
            id,
            position: { x: 100 * (i + 1), y: 100 * (i + 1) },
            data: { content: `Content from user${i + 1}` }
          })),
          createNode: jest.fn().mockImplementation((nodeData) => {
            const id = nodeData.id || `node-${Date.now()}`;
            return id;
          }),
          updateNode: jest.fn(),
          deleteNode: jest.fn(),
          createEdge: jest.fn().mockImplementation((edgeData) => {
            const id = edgeData.id || `edge-${Date.now()}`;
            return id;
          }),
          updateEdge: jest.fn(),
          deleteEdge: jest.fn(),
          disconnect: jest.fn(),
          connect: jest.fn(),
        });
      }

      return {
        clients: mockClients,
        syncAll: jest.fn(),
        cleanup: jest.fn(),
        waitForSync: jest.fn().mockImplementation(() => Promise.resolve()),
        disconnectClient: jest.fn(),
        reconnectClient: jest.fn(),
      };
    }),
  };
});

describe('Collaborative Editing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Reference: REQ-401.1 Concurrent Node Creation
  describe('Concurrent Node Operations', () => {
    it('should handle concurrent node creation by multiple users', async () => {
      // Arrange
      const { clients, waitForSync } = createTestMultiUserEnvironment();
      
      // Act - Multiple users create nodes concurrently
      const nodeId1 = clients[0].createNode({
        data: { content: 'Node from User 1' },
        position: { x: 100, y: 100 },
      });
      
      const nodeId2 = clients[1].createNode({
        data: { content: 'Node from User 2' },
        position: { x: 200, y: 200 },
      });
      
      // Wait for sync
      await waitForSync();
      
      // Assert - All clients should see both nodes
      expect(clients[0].getNode(nodeId1)).toBeDefined();
      expect(clients[0].getNode(nodeId2)).toBeDefined();
      expect(clients[1].getNode(nodeId1)).toBeDefined();
      expect(clients[1].getNode(nodeId2)).toBeDefined();
      expect(clients[2].getNode(nodeId1)).toBeDefined();
      expect(clients[2].getNode(nodeId2)).toBeDefined();
    });

    it('should correctly apply node updates from multiple clients', async () => {
      // Arrange
      const { clients, waitForSync } = createTestMultiUserEnvironment();
      const nodeId = clients[0].createNode({
        data: { content: 'Original content' },
        position: { x: 100, y: 100 },
      });
      
      await waitForSync();
      
      // Act - Apply updates to the same node from different clients
      const update1 = {
        id: nodeId,
        data: { content: 'Updated by User 1' },
        position: { x: 150, y: 100 },
      };
      
      const update2 = {
        id: nodeId,
        data: { content: 'Updated by User 2' },
        position: { x: 100, y: 150 },
      };
      
      // Simulate concurrent updates
      applyNodeUpdate(clients[0].doc, nodeId, update1);
      applyNodeUpdate(clients[1].doc, nodeId, update2);
      
      // Wait for sync
      await waitForSync();
      
      // Assert - The updates should be merged according to conflict resolution rules
      const finalNode0 = clients[0].getNode(nodeId);
      const finalNode1 = clients[1].getNode(nodeId);
      const finalNode2 = clients[2].getNode(nodeId);
      
      // All clients should converge to the same state
      expect(finalNode0?.data?.content).toEqual(finalNode1?.data?.content);
      expect(finalNode1?.data?.content).toEqual(finalNode2?.data?.content);
      expect(finalNode0?.position).toEqual(finalNode1?.position);
      expect(finalNode1?.position).toEqual(finalNode2?.position);
    });
    
    it('should handle concurrent node deletion and editing', async () => {
      // Arrange
      const { clients, waitForSync } = createTestMultiUserEnvironment();
      const nodeId = clients[0].createNode({
        data: { content: 'Node to be deleted' },
        position: { x: 100, y: 100 },
      });
      
      await waitForSync();
      
      // Act - One user deletes while another edits
      clients[0].deleteNode(nodeId);
      
      const update = {
        id: nodeId,
        data: { content: 'Updated content' },
        position: { x: 200, y: 200 },
      };
      
      applyNodeUpdate(clients[1].doc, nodeId, update);
      
      // Wait for sync
      await waitForSync();
      
      // Assert - Deletion should take precedence
      expect(clients[0].getNode(nodeId)).toBeUndefined();
      expect(clients[1].getNode(nodeId)).toBeUndefined();
      expect(clients[2].getNode(nodeId)).toBeUndefined();
    });
  });

  // Reference: REQ-401.2 Concurrent Edge Operations
  describe('Concurrent Edge Operations', () => {
    it('should handle concurrent edge creation between multiple users', async () => {
      // Arrange
      const { clients, waitForSync } = createTestMultiUserEnvironment();
      
      // Create source and target nodes
      const sourceId = clients[0].createNode({
        data: { content: 'Source Node' },
        position: { x: 100, y: 100 },
      });
      
      const targetId = clients[0].createNode({
        data: { content: 'Target Node' },
        position: { x: 300, y: 300 },
      });
      
      await waitForSync();
      
      // Act - Create edges concurrently
      const edgeId1 = clients[0].createEdge({
        source: sourceId,
        target: targetId,
        data: { label: 'Edge from User 1' },
      });
      
      const edgeId2 = clients[1].createEdge({
        source: sourceId,
        target: targetId,
        data: { label: 'Edge from User 2' },
      });
      
      // Wait for sync
      await waitForSync();
      
      // Assert - Both edges should exist for all clients
      expect(clients[0].getEdge(edgeId1)).toBeDefined();
      expect(clients[0].getEdge(edgeId2)).toBeDefined();
      expect(clients[1].getEdge(edgeId1)).toBeDefined();
      expect(clients[1].getEdge(edgeId2)).toBeDefined();
      expect(clients[2].getEdge(edgeId1)).toBeDefined();
      expect(clients[2].getEdge(edgeId2)).toBeDefined();
    });
    
    it('should correctly apply edge updates from multiple clients', async () => {
      // Arrange
      const { clients, waitForSync } = createTestMultiUserEnvironment();
      
      // Create source and target nodes
      const sourceId = clients[0].createNode({
        data: { content: 'Source Node' },
        position: { x: 100, y: 100 },
      });
      
      const targetId = clients[0].createNode({
        data: { content: 'Target Node' },
        position: { x: 300, y: 300 },
      });
      
      // Create an edge
      const edgeId = clients[0].createEdge({
        source: sourceId,
        target: targetId,
        data: { label: 'Original Edge' },
      });
      
      await waitForSync();
      
      // Act - Update the edge concurrently
      const update1 = {
        id: edgeId,
        data: { label: 'Updated by User 1' },
      };
      
      const update2 = {
        id: edgeId,
        data: { label: 'Updated by User 2' },
      };
      
      applyEdgeUpdate(clients[0].doc, edgeId, update1);
      applyEdgeUpdate(clients[1].doc, edgeId, update2);
      
      // Wait for sync
      await waitForSync();
      
      // Assert - Updates should be merged according to conflict resolution rules
      const finalEdge0 = clients[0].getEdge(edgeId);
      const finalEdge1 = clients[1].getEdge(edgeId);
      const finalEdge2 = clients[2].getEdge(edgeId);
      
      // All clients should converge to the same state
      expect(finalEdge0?.data?.label).toEqual(finalEdge1?.data?.label);
      expect(finalEdge1?.data?.label).toEqual(finalEdge2?.data?.label);
    });
  });

  // Reference: REQ-401.3 Conflict Resolution
  describe('Conflict Resolution', () => {
    it('should resolve position conflicts with last-writer-wins strategy', () => {
      // Arrange
      const originalPosition = { x: 100, y: 100 };
      const userAPosition = { x: 200, y: 100 };
      const userBPosition = { x: 100, y: 200 };
      const timestamp1 = Date.now();
      const timestamp2 = timestamp1 + 1000; // User B is later
      
      // Act
      const resolvedPosition = resolveConflict(
        'position',
        originalPosition,
        userAPosition,
        userBPosition,
        timestamp1,
        timestamp2
      );
      
      // Assert - Later timestamp should win
      expect(resolvedPosition).toEqual(userBPosition);
    });
    
    it('should merge content conflicts by preserving both contents', () => {
      // Arrange
      const originalContent = 'Original content';
      const userAContent = 'User A content';
      const userBContent = 'User B content';
      const timestamp1 = Date.now();
      const timestamp2 = timestamp1 + 1000;
      
      // Act
      const resolvedContent = resolveConflict(
        'content',
        originalContent,
        userAContent,
        userBContent,
        timestamp1,
        timestamp2
      );
      
      // Assert - Content should be merged with both changes
      expect(resolvedContent).toContain(userAContent);
      expect(resolvedContent).toContain(userBContent);
    });
    
    it('should handle complex nested data conflicts', () => {
      // Arrange
      const originalData = { 
        title: 'Original',
        tags: ['tag1', 'tag2'],
        metadata: { created: '2023-01-01' }
      };
      
      const userAData = {
        title: 'User A Title',
        tags: ['tag1', 'tag3'],
        metadata: { created: '2023-01-01', updated: '2023-02-01' }
      };
      
      const userBData = {
        title: 'User B Title',
        tags: ['tag2', 'tag4'],
        metadata: { created: '2023-01-01', author: 'User B' }
      };
      
      const timestamp1 = Date.now();
      const timestamp2 = timestamp1 + 1000;
      
      // Act
      const resolvedData = resolveConflict(
        'data',
        originalData,
        userAData,
        userBData,
        timestamp1,
        timestamp2
      );
      
      // Assert - Data should be merged correctly
      expect(resolvedData.title).toBe('User B Title'); // Last writer wins for scalar values
      expect(resolvedData.tags).toContain('tag1');
      expect(resolvedData.tags).toContain('tag2');
      expect(resolvedData.tags).toContain('tag3');
      expect(resolvedData.tags).toContain('tag4');
      expect((resolvedData.metadata as ResolvedMetadata).created).toBe('2023-01-01');
      expect((resolvedData.metadata as ResolvedMetadata).updated).toBe('2023-02-01');
      expect((resolvedData.metadata as ResolvedMetadata).author).toBe('User B');
    });
  });

  // Reference: REQ-401.4 Offline Editing
  describe('Offline Editing', () => {
    it('should sync changes after a client reconnects', async () => {
      // Arrange
      const { clients, waitForSync, disconnectClient, reconnectClient } = createTestMultiUserEnvironment();
      
      // Create a node
      const nodeId = clients[0].createNode({
        data: { content: 'Before Offline' },
        position: { x: 100, y: 100 },
      });
      
      await waitForSync();
      
      // Act - Disconnect client 1, then make changes from both sides
      disconnectClient(1);
      
      // Online client makes changes
      const update0 = {
        id: nodeId,
        position: { x: 200, y: 200 },
      };
      applyNodeUpdate(clients[0].doc, nodeId, update0);
      
      // Offline client makes changes
      const update1 = {
        id: nodeId,
        data: { content: 'Updated Offline' },
      };
      applyNodeUpdate(clients[1].doc, nodeId, update1);
      
      // Reconnect the offline client
      reconnectClient(1);
      
      // Wait for sync
      await waitForSync();
      
      // Assert - Changes from both clients should be merged
      const finalNode0 = clients[0].getNode(nodeId);
      const finalNode1 = clients[1].getNode(nodeId);
      const finalNode2 = clients[2].getNode(nodeId);
      
      // Position from online client, content from offline client
      expect(finalNode0?.position).toEqual({ x: 200, y: 200 });
      expect(finalNode1?.position).toEqual({ x: 200, y: 200 });
      expect(finalNode2?.position).toEqual({ x: 200, y: 200 });
      
      expect(finalNode0?.data?.content).toBe('Updated Offline');
      expect(finalNode1?.data?.content).toBe('Updated Offline');
      expect(finalNode2?.data?.content).toBe('Updated Offline');
    });
  });
}); 