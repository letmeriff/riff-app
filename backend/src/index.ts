import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './config/supabase';
import { authMiddleware } from './middleware/auth';
import modelRoutes from './routes/modelRoutes';
import chatRoutes from './routes/chatRoutes';
import flavorRoutes from './routes/flavorRoutes';
import contextRoutes from './routes/contextRoutes';
import summarizationRoutes from './routes/summarizationRoutes';
import branchRoutes from './routes/branchRoutes';
import presenceRoutes from './routes/presenceRoutes';
import { processPendingSummaries } from './services/summarizationJob';
import { updateUserPresence, removeUserPresence, getUserPresence } from './services/presenceService';

// Define interfaces for the payload structures
interface ChatNode {
  node_id: number;
  user_id: string;
  owner_id: string;
  title: string;
  model: string;
  flavor: string;
  created_at: string;
}

interface ChatMessage {
  message_id: number;
  node_id: number;
  content: string;
  is_user: boolean;
  timestamp: string;
}

// Add interfaces for the payload types
interface ChatNodePayload {
  new: ChatNode | null;
  old: Partial<ChatNode> | null;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

interface ChatMessagePayload {
  new: ChatMessage | null;
  old: Partial<ChatMessage> | null;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3001;

// Set up Socket.IO with CORS
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

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
app.use('/api/models', modelRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/flavors', flavorRoutes);
app.use('/api/context', contextRoutes);
app.use('/api/summarize', summarizationRoutes);
app.use('/api/branch', branchRoutes);
app.use('/api/presence', presenceRoutes);

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
      socket.emit('ownership-update', { 
        nodeId, 
        isOwner: node.owner_id === userId,
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

  // Handle ownership transfer
  socket.on('transfer-ownership', async ({ nodeId, newOwnerId }) => {
    try {
      const userId = socket.data.user.id;
      
      // Verify the current user is the owner
      const { data: node, error } = await supabase
        .from('chat_nodes')
        .select('owner_id')
        .eq('node_id', nodeId)
        .single();
      
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
      const { error: updateError } = await supabase
        .from('chat_nodes')
        .update({ owner_id: newOwnerId })
        .eq('node_id', nodeId);
      
      if (updateError) {
        console.error('Error updating node owner:', updateError);
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
    (payload: any) => {
      const newNode = payload.new as ChatNode | null;
      const oldNode = payload.old as Partial<ChatNode> | null;
      const nodeId = newNode?.node_id || oldNode?.node_id;
      if (nodeId) {
        const nodeRoom = `node:${nodeId}`;
        io.to(nodeRoom).emit('node-update', payload);
      }
      io.emit('node-update', payload);
    }
  )
  .subscribe();

supabase
  .channel('chat_messages')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    async (payload: any) => {
      try {
        if (payload.new && typeof payload.new.node_id === 'number') {
          const nodeId = payload.new.node_id;
          const nodeRoom = `node:${nodeId}`;
          io.to(nodeRoom).emit('message-update', payload);
        }
      } catch (error) {
        console.error('Error handling message change:', error);
      }
    }
  )
  .subscribe();

// Set up periodic summary job
setInterval(processPendingSummaries, 5 * 60 * 1000);
processPendingSummaries();

// Start the server
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
