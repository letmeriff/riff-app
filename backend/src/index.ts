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
const io = new Server(httpServer, {
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

  // Handle join-node event
  socket.on('join-node', async ({ nodeId }) => {
    try {
      const userId = socket.data.user.id;
      const email = socket.data.user.email || 'unknown@example.com';

      console.log(`User ${userId} (${email}) joined node ${nodeId}`);

      // Update presence for the node
      await updateUserPresence(nodeId, userId, email, false);

      // Get updated presence
      const presence = await getUserPresence(nodeId);

      // Broadcast updated presence to all users who should see this node
      // For now, just broadcasting back to the same user
      io.to(userRoom).emit('presence-update', { nodeId, presence });
    } catch (error) {
      console.error('Error handling join-node event:', error);
    }
  });

  // Handle leave-node event
  socket.on('leave-node', async ({ nodeId }) => {
    try {
      const userId = socket.data.user.id;
      console.log(`User ${userId} left node ${nodeId}`);

      // Remove the user from the node's presence
      await removeUserPresence(nodeId, userId);

      // Get updated presence
      const presence = await getUserPresence(nodeId);

      // Broadcast updated presence
      io.to(userRoom).emit('presence-update', { nodeId, presence });
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

      // Broadcast updated presence
      io.to(userRoom).emit('presence-update', { nodeId, presence });
    } catch (error) {
      console.error('Error handling typing event:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.data.user.id}`);
    // User presence will timeout automatically after 30 seconds
  });
});

// Subscribe to Supabase changes and broadcast them via Socket.IO
supabase
  .channel('chat_nodes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'chat_nodes' },
    (payload) => {
      // Cast the payload to our typed interface
      const typedPayload = payload as unknown as ChatNodePayload;
      // Broadcast to the appropriate user room
      const userId = typedPayload.new?.user_id || typedPayload.old?.user_id;
      if (userId) {
        io.to(`user:${userId}`).emit('node-update', typedPayload);
      }
    }
  )
  .subscribe();

supabase
  .channel('chat_messages')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    async (payload) => {
      try {
        // Cast the payload to our typed interface
        const typedPayload = payload as unknown as ChatMessagePayload;
        
        if (!typedPayload.new?.node_id) {
          console.error('Missing node_id in new message payload');
          return;
        }
        
        // Get the user_id associated with the node
        const { data: node, error } = await supabase
          .from('chat_nodes')
          .select('user_id')
          .eq('node_id', typedPayload.new.node_id)
          .single();
        
        if (error) {
          console.error('Error fetching node user:', error);
          return;
        }
        
        // Broadcast the new message to the associated user's room
        io.to(`user:${node.user_id}`).emit('message-update', typedPayload);
      } catch (error) {
        console.error('Error handling message change:', error);
      }
    }
  )
  .subscribe();

// Schedule the summarization job to run every 5 minutes
const FIVE_MINUTES = 5 * 60 * 1000;
setInterval(processPendingSummaries, FIVE_MINUTES);

// Run the job once on startup
processPendingSummaries().catch(err => 
  console.error('Error running initial summarization job:', err)
);

httpServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
