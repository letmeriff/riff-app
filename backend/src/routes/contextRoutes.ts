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
    const { targetNodeId, originNodeId, mode = 'full' } = req.body;

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

    // Check if a context pull relationship already exists
    const existingPull = await getContextPullByNodes(targetNodeId, originNodeId);
    
    let context = '';
    let isIncremental = false;
    
    // If mode is 'summary', we don't need to fetch messages here
    // The frontend handles inserting the summary message via a separate API endpoint
    if (mode === 'summary') {
      // Just update/create the relationship for tracking purposes
      if (existingPull) {
        await updateContextPull(existingPull.id);
      } else {
        await createContextPull(targetNodeId, originNodeId);
      }
      
      return res.json({ 
        success: true,
        message: "Summary was pulled via separate endpoint",
        isIncremental: false,
        mode: 'summary'
      });
    }
    
    // For 'full' mode, proceed with the original logic
    if (existingPull) {
      // Incremental update: fetch only new messages since the last pull
      const { data: newMessages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('node_id', originNodeId)
        .gt('timestamp', existingPull.last_pulled_at)
        .order('timestamp', { ascending: true });
      
      if (messagesError) throw messagesError;

      if (newMessages && newMessages.length > 0) {
        context = newMessages
          .map((msg) => `${msg.is_user ? 'User' : 'AI'}: ${msg.content}`)
          .join('\n');
        isIncremental = true;
      } else {
        context = 'No new messages since last pull';
      }
      
      // Update the last_pulled_at timestamp
      await updateContextPull(existingPull.id);
    } else {
      // First pull: fetch the entire chat history
      const { data: originMessages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('node_id', originNodeId)
        .order('timestamp', { ascending: true });
      
      if (messagesError) throw messagesError;

      if (originMessages && originMessages.length > 0) {
        context = originMessages
          .map((msg) => `${msg.is_user ? 'User' : 'AI'}: ${msg.content}`)
          .join('\n');
      } else {
        context = 'No messages available in the origin node';
      }
      
      // Create a new context pull relationship
      await createContextPull(targetNodeId, originNodeId);
    }

    // Add a placeholder message to the target node's chat
    const placeholderMessage = isIncremental 
      ? `New context pulled from Node ${originNodeId}:\n${context}`
      : `Context pulled from Node ${originNodeId}:\n${context}`;
      
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
      message: placeholderMessage,
      isIncremental: isIncremental,
      mode: 'full'
    });
  } catch (error: unknown) {
    console.error('Error pulling context:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to pull context' 
    });
  }
});

export default router; 