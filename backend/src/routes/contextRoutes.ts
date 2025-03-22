import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createContextPull, getContextPullByNodes, updateContextPull } from '../services/contextPullService';
import { supabase } from '../config/supabase';

const router = express.Router();

/**
 * Pull context from another node
 * POST /api/context/pull
 */
router.post('/pull', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { targetNodeId, originNodeId } = req.body;

    if (!targetNodeId || !originNodeId) {
      return res.status(400).json({ error: 'targetNodeId and originNodeId are required' });
    }

    // Ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check node ownership or collaboration access
    const { data: targetNode, error: targetError } = await supabase
      .from('chat_nodes')
      .select('*')
      .eq('node_id', targetNodeId)
      .single();
    
    if (targetError) {
      return res.status(404).json({ error: 'Target node not found' });
    }
    
    if (targetNode.user_id !== req.user.id) {
      // Check if user is a collaborator (simplified - would need collaborators table)
      return res.status(403).json({ error: 'You do not have access to this node' });
    }

    // Fetch the chat history from the origin node
    const { data: originMessages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('node_id', originNodeId)
      .order('timestamp', { ascending: true });
    
    if (messagesError) throw messagesError;

    // Format the chat history as a string
    const context = originMessages
      .map((msg) => `${msg.is_user ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n');

    // Check if a context pull relationship already exists
    const existingPull = await getContextPullByNodes(targetNodeId, originNodeId);

    if (existingPull) {
      // Update the last_pulled_at timestamp
      await updateContextPull(existingPull.id);
    } else {
      // Create a new context pull relationship
      await createContextPull(targetNodeId, originNodeId);
    }

    // Add a system message to the target node's chat
    const placeholderMessage = `Context pulled from Node ${originNodeId}:\n${context}`;
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        node_id: targetNodeId,
        content: placeholderMessage,
        is_user: false,
        timestamp: new Date().toISOString(),
      });
    
    if (insertError) throw insertError;

    res.json({ 
      success: true,
      message: placeholderMessage 
    });
  } catch (error: unknown) {
    console.error('Error pulling context:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to pull context' 
    });
  }
});

export default router; 