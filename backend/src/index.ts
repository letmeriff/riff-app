import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { supabase } from './config/supabase';
import { authMiddleware } from './middleware/auth';
import modelRoutes from './routes/modelRoutes';
import chatRoutes from './routes/chatRoutes';
import flavorRoutes from './routes/flavorRoutes';
import promptRoutes from './routes/promptRoutes';
import contextRoutes from './routes/contextRoutes';
import summarizationRoutes from './routes/summarizationRoutes';
import branchRoutes from './routes/branchRoutes';
import presenceRoutes from './routes/presenceRoutes';
import attachmentRoutes from './routes/attachmentRoutes';
import ownershipRoutes from './routes/ownershipRoutes';
import nodeRoutes from './routes/nodeRoutes';
import { processPendingSummaries } from './services/summarizationJob';
import { updateUserPresence, removeUserPresence, getUserPresence } from './services/presenceService';
import { startYjsWebSocketServer } from './services/yjsWebSocketServer';
import { updateNodePositionYjs, getYjsNodeId, getNodePositionYjs } from './services/yjsNodeService';
import { transferNodeOwnership, getOwnershipInfo } from './services/ownershipService';
import { NodeId } from './types/messaging';
// These route modules don't exist but were referenced
// import authRoutes from './routes/authRoutes';
// import userRoutes from './routes/userRoutes';
// import nodeRoutes from './routes/nodeRoutes';
// import uploadRoutes from './routes/uploadRoutes';
// import contextPullRoutes from './routes/contextPullRoutes';

// Define interfaces for the payload structures
interface ChatNode {
  node_id: number;
  user_id: string;
  owner_id: string;
  title: string;
  description?: string;
  model?: string;
  flavor?: string;
  position_x?: number;
  position_y?: number;
  created_at: string;
  updated_at?: string;
}

interface ChatMessage {
  message_id: number;
  node_id: number;
  content: string;
  is_user: boolean;
  timestamp: string;
}

// Add interfaces for the payload types
interface _ChatNodePayload {
  new: ChatNode | null;
  old: Partial<ChatNode> | null;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

interface _ChatMessagePayload {
  new: ChatMessage | null;
  old: Partial<ChatMessage> | null;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

// Define interface for Supabase real-time changes
interface SupabaseChangePayload {
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3001;

// Set up CORS with more permissive settings for development
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://your-production-url.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://wezijqqdnoezwaqtybzo.supabase.co'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Set up Socket.IO with improved CORS and connection settings
export const io = new Server(httpServer, {
  cors: {
    origin: corsOptions.origin,
    methods: corsOptions.methods,
    credentials: corsOptions.credentials,
    allowedHeaders: corsOptions.allowedHeaders
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 10000,
  connectTimeout: 60000,
  allowEIO3: true // Allow older Engine.IO clients
});

// Configure Express middleware with increased payload limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check endpoint (public)
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'RIFF Backend is running' });
});

// Protected routes
app.get('/api/test-supabase', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Only fetch nodes belonging to the authenticated user
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { data, error } = await supabase
      .from('chat_nodes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      throw error;
    }

    res.json({
      status: 'success',
      message: 'Successfully connected to Supabase',
      data,
    });
  } catch (err) {
    console.error('Supabase test error:', err);
    res.status(500).json({
      status: 'error',
      message:
        err instanceof Error ? err.message : 'Failed to connect to Supabase',
    });
  }
});

// API routes
// These routes don't exist but were referenced
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/nodes', nodeRoutes);
// app.use('/api/upload', uploadRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/flavors', flavorRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/context', contextRoutes);
app.use('/api/summarize', summarizationRoutes);
app.use('/api/branch', branchRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/ownership', ownershipRoutes);
// app.use('/api/context-pull', contextPullRoutes);

// API endpoint for saving node position during page unload
app.post('/api/save-node-position', authMiddleware, async (req: Request & { user?: { id: string } }, res) => {
  try {
    const { nodeId, position, useYjs } = req.body;
    
    if (!nodeId || !position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      return res.status(400).json({ error: 'Invalid node position data' });
    }
    
    console.log(`API: Saving position for node ${nodeId}: x=${position.x}, y=${position.y}`);
    
    // Check if we should use Yjs implementation
    if (useYjs || process.env.USE_YJS_POSITIONS === 'true') {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Use Yjs for position updates
      const documentId = `canvas-${nodeId}`;
      const yjsNodeId = getYjsNodeId(nodeId);
      
      const result = await updateNodePositionYjs(documentId, yjsNodeId, position, userId);
      
      if (!result.success) {
        console.error(`Failed to update position using Yjs for node ${nodeId}`);
        // Fall back to traditional approach
      } else {
        return res.json({ success: true, implementation: 'yjs' });
      }
    }
    
    // Update the position in the database using traditional approach
    const { error } = await supabase
      .from('chat_nodes')
      .update({ 
        position_x: position.x, 
        position_y: position.y 
      })
      .eq('node_id', nodeId);
    
    if (error) {
      console.error('Error updating node position:', error);
      return res.status(500).json({ error: 'Failed to update node position' });
    }
    
    return res.json({ success: true, implementation: 'standard' });
  } catch (error) {
    console.error('Error saving node position:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint for beacon API (fallback)
app.post('/api/save-position', async (req, res) => {
  try {
    const { nodeId, position_x, position_y, useYjs, userId } = req.body;
    
    if (!nodeId || typeof position_x !== 'number' || typeof position_y !== 'number') {
      return res.status(400).json({ error: 'Invalid node position data' });
    }
    
    console.log(`Beacon API: Saving position for node ${nodeId}: x=${position_x}, y=${position_y}`);
    
    // Check if we should use Yjs implementation
    if (useYjs && userId && process.env.USE_YJS_POSITIONS === 'true') {
      // Use Yjs for position updates
      const documentId = `canvas-${nodeId}`;
      const yjsNodeId = getYjsNodeId(nodeId);
      
      const result = await updateNodePositionYjs(documentId, yjsNodeId, { x: position_x, y: position_y }, userId);
      
      if (!result.success) {
        console.error(`Failed to update position using Yjs for node ${nodeId}`);
        // Fall back to traditional approach
      } else {
        return res.json({ success: true, implementation: 'yjs' });
      }
    }
    
    // Update position in database
    const { error } = await supabase
      .from('chat_nodes')
      .update({ position_x, position_y })
      .eq('node_id', nodeId);
    
    if (error) {
      console.error('Error updating node position:', error);
      return res.status(500).json({ error: 'Failed to update node position' });
    }
    
    return res.json({ success: true, implementation: 'standard' });
  } catch (error) {
    console.error('Error in beacon save position:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO authentication middleware
io.use(async (socket: Socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return next(new Error('Authentication error: Invalid token'));
    }

    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: ' + (error instanceof Error ? error.message : 'Unknown error')));
  }
});

// Handle Socket.IO connections
io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.data.user.id}`);

  // Join a room based on the user ID
  const userRoom = `user:${socket.data.user.id}`;
  socket.join(userRoom);

  // Keep track of nodes the user is viewing
  const viewedNodes: number[] = [];

  // Handle join-node event
  socket.on('join-node', async ({ nodeId }) => {
    try {
      const userId = socket.data.user.id;
      const email = socket.data.user.email || 'unknown@example.com';

      console.log(`User ${userId} (${email}) joined node ${nodeId}`);

      // Join the node-specific room
      const nodeRoom = `node:${nodeId}`;
      socket.join(nodeRoom);
      viewedNodes.push(nodeId);

      // Update presence for the node
      await updateUserPresence(nodeId, userId, email, false);

      // Get updated presence
      const presence = await getUserPresence(nodeId);

      // Broadcast updated presence to all users in the node room
      io.to(nodeRoom).emit('presence-update', { nodeId, presence });

      // Check if user is the owner
      const { data: node, error } = await supabase
        .from('chat_nodes')
        .select('owner_id')
        .eq('node_id', nodeId)
        .single();
      
      if (error) {
        console.error('Error fetching node owner:', error);
        return;
      }
      
      // Emit ownership info to the client
      socket.emit('ownership-update', await getOwnershipInfo(nodeId) || {
        nodeId,
        ownerId: node.owner_id
      });
    } catch (error) {
      console.error('Error handling join-node event:', error);
    }
  });

  // Handle leave-node event
  socket.on('leave-node', async ({ nodeId }) => {
    try {
      const userId = socket.data.user.id;
      console.log(`User ${userId} left node ${nodeId}`);

      // Leave the node-specific room
      const nodeRoom = `node:${nodeId}`;
      socket.leave(nodeRoom);
      
      // Remove node from viewed nodes
      const index = viewedNodes.indexOf(nodeId);
      if (index !== -1) {
        viewedNodes.splice(index, 1);
      }

      // Remove the user from the node's presence
      await removeUserPresence(nodeId, userId);

      // Get updated presence
      const presence = await getUserPresence(nodeId);

      // Broadcast updated presence to the node room
      io.to(nodeRoom).emit('presence-update', { nodeId, presence });
    } catch (error) {
      console.error('Error handling leave-node event:', error);
    }
  });

  // Handle typing event
  socket.on('typing', async ({ nodeId, isTyping }) => {
    try {
      const userId = socket.data.user.id;
      const email = socket.data.user.email || 'unknown@example.com';
      console.log(`User ${userId} is ${isTyping ? 'typing' : 'not typing'} in node ${nodeId}`);

      // Update typing status
      await updateUserPresence(nodeId, userId, email, isTyping);

      // Get updated presence
      const presence = await getUserPresence(nodeId);

      // Broadcast updated presence to the node room
      const nodeRoom = `node:${nodeId}`;
      io.to(nodeRoom).emit('presence-update', { nodeId, presence });
    } catch (error) {
      console.error('Error handling typing event:', error);
    }
  });

  // Handle node position update
  socket.on('node-position-update', async ({ nodeId, position }) => {
    try {
      const userId = socket.data.user.id;
      console.log(`User ${userId} updated position of node ${nodeId}:`, position);
      
      // Yjs implementation is now the only supported method
      const documentId = `canvas-${nodeId}`; // Use node ID as part of document ID for simplicity
      const yjsNodeId = getYjsNodeId(nodeId);
      
      const result = await updateNodePositionYjs(documentId, yjsNodeId, position, userId);
      
      if (result.success) {
        console.log(`Successfully updated position for node ${nodeId} using Yjs`);
        
        // Broadcast the position update to all users
        io.emit('node-position-update', { 
          nodeId, 
          position,
          implementation: 'yjs',
          ...result.data
        });
      } else {
        console.error(`Failed to update position for node ${nodeId} using Yjs`);
      }
    } catch (error) {
      console.error('Error handling node position update:', error);
    }
  });

  // Handle ownership transfer
  socket.on('transfer-ownership', async ({ nodeId, newOwnerId }) => {
    try {
      const userId = socket.data.user.id;
      const typedNodeId: NodeId = parseInt(nodeId);
      
      if (isNaN(typedNodeId)) {
        socket.emit('transfer-ownership-error', { 
          nodeId, 
          error: 'Invalid node ID'
        });
        return;
      }
      
      // Use the ownership service to handle the transfer
      const result = await transferNodeOwnership(typedNodeId, userId, newOwnerId);
      
      if (!result.success) {
        // If the transfer failed, emit the error payload
        socket.emit('transfer-ownership-error', result.payload);
        return;
      }
      
      // Broadcast ownership change to all users in the node
      const nodeRoom = `node:${typedNodeId}`;
      io.to(nodeRoom).emit('ownership-update', result.payload);
      
      console.log(`Ownership of node ${typedNodeId} transferred from ${userId} to ${newOwnerId}`);
    } catch (error) {
      console.error('Error handling ownership transfer:', error);
      socket.emit('transfer-ownership-error', { 
        nodeId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Handle attachment update event
  socket.on('attachment-update', async ({ nodeId, attachment }) => {
    try {
      // Broadcast the attachment update to all clients in the node room
      const nodeRoom = `node:${nodeId}`;
      io.to(nodeRoom).emit('attachment-update', { nodeId, attachment });

      // Update the node state with the new attachment
      const { data: pulledConnections } = await supabase
        .from('context_pulls')
        .select('origin_node_id, last_pulled_at')
        .eq('target_node_id', nodeId);
      
      const pulledConnectionsWithUpdates = await Promise.all(
        (pulledConnections || []).map(async (pull) => {
          const { data: latestMessage } = await supabase
            .from('chat_messages')
            .select('timestamp')
            .eq('node_id', pull.origin_node_id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();
          
          const hasUpdates = latestMessage
            ? new Date(latestMessage.timestamp) > new Date(pull.last_pulled_at)
            : false;
          
          return { nodeId: pull.origin_node_id.toString(), hasUpdates };
        })
      );

      const { data: pulledByConnections } = await supabase
        .from('context_pulls')
        .select('target_node_id')
        .eq('origin_node_id', nodeId);
      
      const pulledByConnectionsData = (pulledByConnections || []).map((pull) => ({
        nodeId: pull.target_node_id.toString(),
      }));

      const { data: nodeAttachments } = await supabase
        .from('chat_attachments')
        .select('*')
        .eq('node_id', nodeId);
      
      const attachments = await Promise.all((nodeAttachments || []).map(async (att) => {
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
        const { data: urlData } = await supabase.storage
          .from('chat-attachments')
          .createSignedUrl(att.file_path, 60 * 60 * 24 * 365);
        
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
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.data.user.id}`);
    
    // Clean up all viewed nodes on disconnect
    for (const nodeId of viewedNodes) {
      try {
        const userId = socket.data.user.id;
        
        // Remove the user from the node's presence
        await removeUserPresence(nodeId, userId);
        
        // Get updated presence
        const presence = await getUserPresence(nodeId);
        
        // Broadcast updated presence to the node room
        const nodeRoom = `node:${nodeId}`;
        io.to(nodeRoom).emit('presence-update', { nodeId, presence });
      } catch (error) {
        console.error(`Error cleaning up node ${nodeId}:`, error);
      }
    }
  });
});

// Set up Supabase real-time subscriptions
supabase
  .channel('chat_nodes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'chat_nodes' },
    (payload: SupabaseChangePayload) => {
      try {
        const newNode = payload.new as ChatNode | null;
        const oldNode = payload.old as Partial<ChatNode> | null;
        const nodeId = newNode?.node_id || oldNode?.node_id;
        
        if (!nodeId) {
          console.error('No node ID found in payload:', payload);
          return;
        }
        
        // Create standardized payload
        let nodeUpdatePayload = null;
        
        if (newNode) {
          nodeUpdatePayload = {
            nodeId,
            new: {
              node_id: nodeId,
              title: newNode.title || '',
              ...(newNode.description && { description: newNode.description }),
              user_id: newNode.user_id,
              owner_id: newNode.owner_id,
              model: newNode.model,
              flavor: newNode.flavor,
              position_x: newNode.position_x,
              position_y: newNode.position_y,
              created_at: newNode.created_at,
              updated_at: newNode.updated_at
            }
          };
        }
        
        // Emit to specific node room if it exists
        const nodeRoom = `node:${nodeId}`;
        
        if (nodeUpdatePayload) {
          io.to(nodeRoom).emit('node-update', nodeUpdatePayload);
        } else {
          // For deletion events, create a minimal payload
          io.to(nodeRoom).emit('node-update', { 
            nodeId, 
            new: null 
          });
        }
        
        // Also emit to general channel for node listings
        io.emit('node-list-update', payload);
      } catch (error) {
        console.error('Error handling node change:', error);
      }
    }
  )
  .subscribe();

supabase
  .channel('chat_messages')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    async (payload: SupabaseChangePayload) => {
      try {
        if (payload.new && typeof payload.new.node_id === 'number') {
          const nodeId: NodeId = payload.new.node_id;
          const nodeRoom = `node:${nodeId}`;
          
          // Create a standardized message update payload
          const messagePayload = {
            nodeId,
            messageId: payload.new.message_id,
            new: {
              node_id: nodeId,
              message_id: payload.new.message_id,
              content: payload.new.content,
              is_user: payload.new.is_user,
              timestamp: payload.new.timestamp,
              user_id: payload.new.user_id,
              email: payload.new.email
            }
          };
          
          io.to(nodeRoom).emit('message-update', messagePayload);
        }
      } catch (error) {
        console.error('Error handling message change:', error);
      }
    }
  )
  .subscribe();

// Add channel for chat_attachments
supabase
  .channel('chat_attachments')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'chat_attachments' },
    async (payload: SupabaseChangePayload) => {
      try {
        const nodeId = payload.new?.node_id || payload.old?.node_id;
        if (nodeId) {
          const typedNodeId: NodeId = nodeId as NodeId;
          const nodeRoom = `node:${typedNodeId}`;
          
          // Emit the raw change for backward compatibility
          io.to(nodeRoom).emit('attachment-change', payload);
          
          // If it's a new attachment, fetch the complete data and broadcast it
          if (payload.eventType === 'INSERT' && payload.new) {
            const { data: attachment } = await supabase
              .from('chat_attachments')
              .select('*')
              .eq('attachment_id', payload.new.attachment_id)
              .single();
              
            if (attachment) {
              const enhancedAttachment = { ...attachment };
              
              // Add signed URL if needed
              if (!attachment.file_url) {
                const { data: urlData } = await supabase.storage
                  .from('chat-attachments')
                  .createSignedUrl(attachment.file_path, 60 * 60 * 24 * 365);
                
                enhancedAttachment.file_url = urlData?.signedUrl || null;
              }
              
              // Create standardized attachment update payload
              const attachmentPayload = {
                nodeId: typedNodeId,
                attachmentId: attachment.attachment_id,
                attachment: {
                  attachment_id: attachment.attachment_id,
                  node_id: typedNodeId,
                  file_url: enhancedAttachment.file_url,
                  file_type: attachment.file_type,
                  file_name: attachment.file_name,
                  file_size: attachment.file_size,
                  created_at: attachment.created_at,
                  user_id: attachment.user_id
                }
              };
              
              io.to(nodeRoom).emit('attachment-update', attachmentPayload);
            }
          } else if (payload.eventType === 'DELETE' && payload.old) {
            // Create standardized attachment delete payload
            const deletePayload = {
              nodeId: typedNodeId,
              attachmentId: payload.old.attachment_id
            };
            
            io.to(nodeRoom).emit('attachment-delete', deletePayload);
          }
        }
      } catch (error) {
        console.error('Error handling attachment change:', error);
      }
    }
  )
  .subscribe();

// Set up periodic summary job
setInterval(processPendingSummaries, 5 * 60 * 1000);
processPendingSummaries();

// API endpoint to fetch node position history
app.get('/api/node-position-history/:nodeId', authMiddleware, async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { limit = 20 } = req.query;
    
    // Get position history for the node
    const { data, error } = await supabase
      .from('node_position_history')
      .select('*')
      .eq('node_id', nodeId)
      .order('lamport_timestamp', { ascending: false })
      .limit(parseInt(limit as string));
    
    if (error) {
      console.error('Error fetching node position history:', error);
      return res.status(500).json({ error: 'Failed to fetch node position history' });
    }
    
    return res.json(data);
  } catch (error) {
    console.error('Error in position history API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to fetch node position from Yjs
app.get('/api/yjs-node-position/:documentId/:nodeId', authMiddleware, async (req: Request & { user?: { id: string } }, res) => {
  try {
    const { documentId, nodeId } = req.params;
    
    if (!documentId || !nodeId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const position = await getNodePositionYjs(documentId, nodeId);
    
    if (!position) {
      return res.status(404).json({ error: 'Node position not found in Yjs document' });
    }
    
    return res.json({ success: true, position });
  } catch (error) {
    console.error('Error fetching node position from Yjs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  
  // Initialize Yjs WebSocket server
  const _yjsWss = startYjsWebSocketServer(httpServer);
  console.log('Yjs WebSocket server is listening for connections');
  
  // Start the summarization job scheduler
  processPendingSummaries();
});
