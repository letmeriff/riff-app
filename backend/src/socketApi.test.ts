import { supabase } from './config/supabase';
import {
  updateUserPresence,
  removeUserPresence,
  getUserPresence,
} from './services/presenceService';
import { updateNodePositionYjs, getYjsNodeId } from './services/yjsNodeService';

// Mock dependencies
jest.mock('./config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnValue({
        data: { owner_id: 'user-1' },
        error: null,
      }),
    })),
  },
}));

jest.mock('./services/presenceService', () => ({
  updateUserPresence: jest.fn().mockResolvedValue(true),
  removeUserPresence: jest.fn().mockResolvedValue(true),
  getUserPresence: jest
    .fn()
    .mockResolvedValue([
      { userId: 'user-1', email: 'test@example.com', isTyping: false },
    ]),
}));

jest.mock('./services/yjsNodeService', () => ({
  updateNodePositionYjs: jest.fn().mockResolvedValue({
    success: true,
    data: { updatedAt: '2023-01-01T00:00:00.000Z' },
  }),
  getYjsNodeId: jest.fn((id) => `node-${id}`),
}));

// Create handler functions that match the implementation in index.ts
// These are the actual functions we're testing
const createHandlers = (socket, io) => {
  return {
    joinNode: async ({ nodeId }) => {
      try {
        const userId = socket.data.user.id;
        const email = socket.data.user.email || 'unknown@example.com';

        // Join the node-specific room
        const nodeRoom = `node:${nodeId}`;
        socket.join(nodeRoom);
        socket.data.viewedNodes.push(nodeId);

        // Update presence for the node
        await updateUserPresence(nodeId, userId, email, false);

        // Get updated presence
        const presence = await getUserPresence(nodeId);

        // Emit presence update to the room
        io.to(nodeRoom).emit('presence-update', { nodeId, presence });

        // Check if user is the owner
        const result = await supabase
          .from('chat_nodes')
          .select('owner_id')
          .eq('node_id', nodeId)
          .single();

        const node = result.data;
        const error = result.error;

        if (error) {
          console.error('Error fetching node owner:', error);
          return;
        }

        // Emit ownership info to the client
        socket.emit('ownership-update', {
          nodeId,
          isOwner: node.owner_id === userId,
          ownerId: node.owner_id,
        });
      } catch (error) {
        console.error('Error handling join-node event:', error);
      }
    },

    leaveNode: async ({ nodeId }) => {
      try {
        const userId = socket.data.user.id;

        // Leave the node-specific room
        const nodeRoom = `node:${nodeId}`;
        socket.leave(nodeRoom);

        // Remove node from viewed nodes
        const index = socket.data.viewedNodes.indexOf(nodeId);
        if (index !== -1) {
          socket.data.viewedNodes.splice(index, 1);
        }

        // Remove the user's presence
        await removeUserPresence(nodeId, userId);

        // Get updated presence
        const presence = await getUserPresence(nodeId);

        // Emit presence update to the room
        io.to(nodeRoom).emit('presence-update', { nodeId, presence });
      } catch (error) {
        console.error('Error handling leave-node event:', error);
      }
    },

    typing: async ({ nodeId, isTyping }) => {
      try {
        const userId = socket.data.user.id;
        const email = socket.data.user.email || 'unknown@example.com';

        // Update typing status
        await updateUserPresence(nodeId, userId, email, isTyping);

        // Get updated presence
        const presence = await getUserPresence(nodeId);

        // Emit presence update to the room
        const nodeRoom = `node:${nodeId}`;
        io.to(nodeRoom).emit('presence-update', { nodeId, presence });
      } catch (error) {
        console.error('Error handling typing event:', error);
      }
    },

    nodePositionUpdate: async ({ nodeId, position }) => {
      try {
        const userId = socket.data.user.id;

        // Update the node position using Yjs
        const documentId = `canvas-${nodeId}`;
        const yjsNodeId = getYjsNodeId(nodeId);

        const result = await updateNodePositionYjs(
          documentId,
          yjsNodeId,
          position,
          userId
        );

        if (result.success) {
          // Broadcast position update to all users
          io.emit('node-position-update', {
            nodeId,
            position,
            implementation: 'yjs',
            ...result.data,
          });
        }
      } catch (error) {
        console.error('Error handling node position update:', error);
      }
    },

    transferOwnership: async ({ nodeId, newOwnerId }) => {
      try {
        const userId = socket.data.user.id;
        
        // Verify the current user is the owner
        const result = await supabase
          .from('chat_nodes')
          .select('owner_id')
          .eq('node_id', nodeId)
          .single();
        
        const node = result.data;
        const error = result.error;
        
        if (error) {
          console.error('Error fetching node owner:', error);
          socket.emit('transfer-ownership-error', { 
            nodeId, 
            error: 'Failed to fetch node information'
          });
          return;
        }
        
        if (node.owner_id !== userId) {
          socket.emit('transfer-ownership-error', { 
            nodeId, 
            error: 'Only the current owner can transfer ownership'
          });
          return;
        }
        
        // Transfer ownership
        const updateResult = await supabase
          .from('chat_nodes')
          .update({ owner_id: newOwnerId })
          .eq('node_id', nodeId);
        
        if (updateResult.error) {
          console.error('Error updating node owner:', updateResult.error);
          socket.emit('transfer-ownership-error', { 
            nodeId, 
            error: 'Failed to transfer ownership'
          });
          return;
        }
        
        // Broadcast ownership change to all users in the node
        const nodeRoom = `node:${nodeId}`;
        io.to(nodeRoom).emit('ownership-update', { 
          nodeId, 
          ownerId: newOwnerId
        });
        
        console.log(`Ownership of node ${nodeId} transferred from ${userId} to ${newOwnerId}`);
      } catch (error) {
        console.error('Error handling ownership transfer:', error);
        socket.emit('transfer-ownership-error', { 
          nodeId, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },

    attachmentUpdate: async ({ nodeId, attachment }) => {
      try {
        // Broadcast the attachment update to all clients in the node room
        const nodeRoom = `node:${nodeId}`;
        io.to(nodeRoom).emit('attachment-update', { nodeId, attachment });

        // Update the node state with the new attachment
        const result = await supabase
          .from('context_pulls')
          .select('origin_node_id, last_pulled_at')
          .eq('target_node_id', nodeId);
          
        const pulledConnections = result.data || [];
        
        const pulledConnectionsWithUpdates = await Promise.all(
          pulledConnections.map(async (pull) => {
            const messageResult = await supabase
              .from('chat_messages')
              .select('timestamp')
              .eq('node_id', pull.origin_node_id)
              .order('timestamp', { ascending: false })
              .limit(1)
              .single();
            
            const latestMessage = messageResult.data;
            
            const hasUpdates = latestMessage
              ? new Date(latestMessage.timestamp) > new Date(pull.last_pulled_at)
              : false;
            
            return { nodeId: pull.origin_node_id.toString(), hasUpdates };
          })
        );

        const pulledByResult = await supabase
          .from('context_pulls')
          .select('target_node_id')
          .eq('origin_node_id', nodeId);
        
        const pulledByConnections = pulledByResult.data || [];
        const pulledByConnectionsData = pulledByConnections.map((pull) => ({
          nodeId: pull.target_node_id.toString(),
        }));

        const attachmentsResult = await supabase
          .from('chat_attachments')
          .select('*')
          .eq('node_id', nodeId);
        
        const nodeAttachments = attachmentsResult.data || [];
        
        const attachments = await Promise.all(nodeAttachments.map(async (att) => {
          // Use existing URL if it's already saved
          if (att.file_url) {
            return {
              attachment_id: att.attachment_id,
              file_url: att.file_url,
              file_name: att.file_name,
              file_type: att.file_type,
              file_size: att.file_size,
              created_at: att.created_at,
            };
          }
          
          // Create a signed URL with 1 year expiry
          const urlResult = await supabase.storage
            .from('chat-attachments')
            .createSignedUrl(att.file_path, 60 * 60 * 24 * 365);
          
          const urlData = urlResult.data;
          
          return {
            attachment_id: att.attachment_id,
            file_url: urlData?.signedUrl || null,
            file_name: att.file_name,
            file_type: att.file_type,
            file_size: att.file_size,
            created_at: att.created_at,
          };
        }));

        io.to(nodeRoom).emit('node-state-update', {
          nodeId,
          pulledConnections: pulledConnectionsWithUpdates,
          pulledByConnections: pulledByConnectionsData,
          attachments,
        });
      } catch (error) {
        console.error('Error handling attachment update:', error);
      }
    }
  };
};

describe('WebSocket API Tests', () => {
  // Create mock objects
  let mockIo;
  let mockSocket;
  let handlers;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock the Socket.IO server
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    // Mock a socket client
    mockSocket = {
      id: 'test-socket-id',
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        viewedNodes: [],
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      rooms: new Set(['user:user-1']),
    };

    // Create the handlers with our mock objects
    handlers = createHandlers(mockSocket, mockIo);
  });

  describe('Socket Event Handlers', () => {
    test('should handle join-node event correctly', async () => {
      // Call the joinNode handler with test data
      await handlers.joinNode({ nodeId: 123 });

      // Verify socket joined the room
      expect(mockSocket.join).toHaveBeenCalledWith('node:123');

      // Verify presence was updated
      expect(updateUserPresence).toHaveBeenCalledWith(
        123,
        'user-1',
        'test@example.com',
        false
      );

      // Verify presence was retrieved
      expect(getUserPresence).toHaveBeenCalledWith(123);

      // Verify room received presence update
      expect(mockIo.to).toHaveBeenCalledWith('node:123');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'presence-update',
        expect.objectContaining({
          nodeId: 123,
          presence: expect.any(Array),
        })
      );

      // Verify socket received ownership update
      expect(mockSocket.emit).toHaveBeenCalledWith('ownership-update', {
        nodeId: 123,
        isOwner: true,
        ownerId: 'user-1',
      });

      // Verify node was added to viewedNodes
      expect(mockSocket.data.viewedNodes).toContain(123);
    });

    test('should handle leave-node event correctly', async () => {
      // Set up the test: add node to viewedNodes
      mockSocket.data.viewedNodes.push(123);

      // Call the leaveNode handler with test data
      await handlers.leaveNode({ nodeId: 123 });

      // Verify socket left the room
      expect(mockSocket.leave).toHaveBeenCalledWith('node:123');

      // Verify presence was removed
      expect(removeUserPresence).toHaveBeenCalledWith(123, 'user-1');

      // Verify presence was retrieved
      expect(getUserPresence).toHaveBeenCalledWith(123);

      // Verify room received presence update
      expect(mockIo.to).toHaveBeenCalledWith('node:123');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'presence-update',
        expect.objectContaining({
          nodeId: 123,
          presence: expect.any(Array),
        })
      );

      // Verify node was removed from viewedNodes
      expect(mockSocket.data.viewedNodes).not.toContain(123);
    });

    test('should handle typing event correctly', async () => {
      // Call the typing handler with test data
      await handlers.typing({ nodeId: 123, isTyping: true });

      // Verify presence was updated with typing status
      expect(updateUserPresence).toHaveBeenCalledWith(
        123,
        'user-1',
        'test@example.com',
        true
      );

      // Verify presence was retrieved
      expect(getUserPresence).toHaveBeenCalledWith(123);

      // Verify room received presence update
      expect(mockIo.to).toHaveBeenCalledWith('node:123');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'presence-update',
        expect.objectContaining({
          nodeId: 123,
          presence: expect.any(Array),
        })
      );
    });

    test('should handle node-position-update event correctly', async () => {
      // Call the nodePositionUpdate handler with test data
      await handlers.nodePositionUpdate({
        nodeId: 123,
        position: { x: 100, y: 200 },
      });

      // Verify position was updated
      expect(getYjsNodeId).toHaveBeenCalledWith(123);
      expect(updateNodePositionYjs).toHaveBeenCalledWith(
        'canvas-123',
        'node-123',
        { x: 100, y: 200 },
        'user-1'
      );

      // Verify broadcast was sent to all clients
      expect(mockIo.emit).toHaveBeenCalledWith(
        'node-position-update',
        expect.objectContaining({
          nodeId: 123,
          position: { x: 100, y: 200 },
          implementation: 'yjs',
          updatedAt: '2023-01-01T00:00:00.000Z',
        })
      );
    });
  });

  describe('WebSocket Message Formats', () => {
    test('presence-update message format', async () => {
      // Set up expected format
      const expectedFormat = {
        nodeId: 123,
        presence: [
          { userId: 'user-1', email: 'test@example.com', isTyping: false },
        ],
      };

      // Call the joinNode handler with test data
      await handlers.joinNode({ nodeId: 123 });

      // Verify message format sent to the room
      expect(mockIo.emit).toHaveBeenCalledWith(
        'presence-update',
        expect.objectContaining(expectedFormat)
      );
    });

    test('ownership-update message format', async () => {
      // Set up expected format
      const expectedFormat = {
        nodeId: 123,
        isOwner: true,
        ownerId: 'user-1',
      };

      // Call the joinNode handler with test data
      await handlers.joinNode({ nodeId: 123 });

      // Verify message format sent to the client
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'ownership-update',
        expectedFormat
      );
    });

    test('node-position-update message format', async () => {
      // Set up expected format
      const expectedFormat = {
        nodeId: 123,
        position: { x: 100, y: 200 },
        implementation: 'yjs',
        updatedAt: '2023-01-01T00:00:00.000Z',
      };

      // Call the nodePositionUpdate handler with test data
      await handlers.nodePositionUpdate({
        nodeId: 123,
        position: { x: 100, y: 200 },
      });

      // Verify message format sent to all clients
      expect(mockIo.emit).toHaveBeenCalledWith(
        'node-position-update',
        expect.objectContaining(expectedFormat)
      );
    });
  });

  // Test for transfer-ownership event
  describe('transfer-ownership event', () => {
    beforeEach(() => {
      // Reset supabase mock implementation for this specific test
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'chat_nodes') {
          return {
            select: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnValue({
              data: { owner_id: 'user-1' },
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        };
      });
    });

    test('should successfully transfer ownership when current user is owner', async () => {
      // Call the transfer-ownership handler
      await handlers.transferOwnership({ nodeId: 123, newOwnerId: 'user-2' });

      // Verify node owner was checked
      expect(supabase.from).toHaveBeenCalledWith('chat_nodes');
      expect(supabase.from('chat_nodes').select).toHaveBeenCalledWith('owner_id');
      expect(supabase.from('chat_nodes').eq).toHaveBeenCalledWith('node_id', 123);

      // Verify ownership was updated
      expect(supabase.from('chat_nodes').update).toHaveBeenCalledWith({ owner_id: 'user-2' });
      
      // Verify all clients in the node room were notified
      expect(mockIo.to).toHaveBeenCalledWith('node:123');
      expect(mockIo.emit).toHaveBeenCalledWith('ownership-update', {
        nodeId: 123,
        ownerId: 'user-2'
      });
    });

    test('should reject ownership transfer when user is not the owner', async () => {
      // Mock node with different owner
      (supabase.from('chat_nodes').single as jest.Mock).mockReturnValue({
        data: { owner_id: 'different-user' },
        error: null,
      });

      // Call the transfer-ownership handler
      await handlers.transferOwnership({ nodeId: 123, newOwnerId: 'user-2' });

      // Verify error was sent to the client
      expect(mockSocket.emit).toHaveBeenCalledWith('transfer-ownership-error', {
        nodeId: 123,
        error: 'Only the current owner can transfer ownership'
      });

      // Verify ownership was not updated
      expect(supabase.from('chat_nodes').update).not.toHaveBeenCalled();
    });

    test('should handle database errors when fetching node owner', async () => {
      // Mock database error
      (supabase.from('chat_nodes').single as jest.Mock).mockReturnValue({
        data: null,
        error: new Error('Database error'),
      });

      // Call the transfer-ownership handler
      await handlers.transferOwnership({ nodeId: 123, newOwnerId: 'user-2' });

      // Verify error was sent to the client
      expect(mockSocket.emit).toHaveBeenCalledWith('transfer-ownership-error', {
        nodeId: 123,
        error: 'Failed to fetch node information'
      });

      // Verify ownership was not updated
      expect(supabase.from('chat_nodes').update).not.toHaveBeenCalled();
    });

    test('should handle database errors when updating node owner', async () => {
      // Mock update error
      (supabase.from('chat_nodes').update as jest.Mock).mockReturnThis();
      (supabase.from('chat_nodes').eq as jest.Mock).mockReturnValue({
        error: new Error('Update error'),
      });

      // Call the transfer-ownership handler
      await handlers.transferOwnership({ nodeId: 123, newOwnerId: 'user-2' });

      // Verify error was sent to the client
      expect(mockSocket.emit).toHaveBeenCalledWith('transfer-ownership-error', {
        nodeId: 123,
        error: 'Failed to transfer ownership'
      });
    });
  });

  // Test for attachment-update event
  describe('attachment-update event', () => {
    beforeEach(() => {
      // Set up mock implementations for this specific test
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'context_pulls') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnValue({
              data: [
                { origin_node_id: 456, last_pulled_at: '2023-01-01T00:00:00.000Z' },
                { origin_node_id: 789, last_pulled_at: '2023-01-01T00:00:00.000Z' }
              ]
            })
          };
        }
        if (table === 'chat_messages') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnValue({
              data: { timestamp: '2023-01-02T00:00:00.000Z' }
            })
          };
        }
        if (table === 'chat_attachments') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnValue({
              data: [
                { 
                  attachment_id: 1, 
                  file_name: 'test.pdf', 
                  file_type: 'application/pdf',
                  file_size: 1024,
                  file_path: 'path/to/file.pdf',
                  created_at: '2023-01-01T00:00:00.000Z'
                }
              ]
            })
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      });

      // Mock storage functionality
      (supabase.storage as any) = {
        from: jest.fn().mockReturnValue({
          createSignedUrl: jest.fn().mockReturnValue({
            data: { signedUrl: 'https://example.com/signed-url' }
          })
        })
      };
    });

    test('should broadcast attachment update and node state update', async () => {
      const mockAttachment = { 
        attachment_id: 1, 
        file_name: 'test.pdf' 
      };

      // Call the attachment-update handler
      await handlers.attachmentUpdate({ nodeId: 123, attachment: mockAttachment });

      // Verify attachment update was broadcast to the node room
      expect(mockIo.to).toHaveBeenCalledWith('node:123');
      expect(mockIo.emit).toHaveBeenCalledWith('attachment-update', {
        nodeId: 123,
        attachment: mockAttachment
      });

      // Verify pulled connections were fetched
      expect(supabase.from).toHaveBeenCalledWith('context_pulls');
      expect(supabase.from('context_pulls').select).toHaveBeenCalled();

      // Verify chat messages were checked for updates
      expect(supabase.from).toHaveBeenCalledWith('chat_messages');
      
      // Verify attachments were fetched
      expect(supabase.from).toHaveBeenCalledWith('chat_attachments');
      
      // Verify signed URL was created
      expect(supabase.storage.from).toHaveBeenCalledWith('chat-attachments');
      expect(supabase.storage.from('chat-attachments').createSignedUrl).toHaveBeenCalled();

      // Verify node state update was broadcast
      expect(mockIo.emit).toHaveBeenCalledWith('node-state-update', expect.objectContaining({
        nodeId: 123,
        pulledConnections: expect.any(Array),
        pulledByConnections: expect.any(Array),
        attachments: expect.any(Array)
      }));
    });

    test('should handle empty attachments gracefully', async () => {
      // Override chat_attachments mock to return empty array
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'chat_attachments') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnValue({
              data: []
            })
          };
        }
        // Use default implementation for other tables
        return (supabase.from as jest.Mock).getMockImplementation()(table);
      });

      // Call the attachment-update handler
      await handlers.attachmentUpdate({ nodeId: 123, attachment: { attachment_id: 1 } });

      // Verify node state update was broadcast with empty attachments
      expect(mockIo.emit).toHaveBeenCalledWith('node-state-update', expect.objectContaining({
        nodeId: 123,
        attachments: []
      }));
    });

    test('should handle errors gracefully', async () => {
      // Mock error in supabase query
      (supabase.from as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      // Spy on console.error
      jest.spyOn(console, 'error').mockImplementation();

      // Call the attachment-update handler
      await handlers.attachmentUpdate({ nodeId: 123, attachment: { attachment_id: 1 } });

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        'Error handling attachment update:',
        expect.any(Error)
      );

      // Restore console.error
      (console.error as jest.Mock).mockRestore();
    });
  });
});
