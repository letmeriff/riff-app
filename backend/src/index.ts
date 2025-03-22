import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { supabase } from './config/supabase';
import { authMiddleware } from './middleware/auth';
import modelRoutes from './routes/modelRoutes';
import chatRoutes from './routes/chatRoutes';
import flavorRoutes from './routes/flavorRoutes';
import contextRoutes from './routes/contextRoutes';
import summarizationRoutes from './routes/summarizationRoutes';
import { processPendingSummaries } from './services/summarizationJob';

const app = express();
const port = process.env.PORT || 3001;

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

// Schedule the summarization job to run every 5 minutes
const FIVE_MINUTES = 5 * 60 * 1000;
setInterval(processPendingSummaries, FIVE_MINUTES);

// Run the job once on startup
processPendingSummaries().catch(err => 
  console.error('Error running initial summarization job:', err)
);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
