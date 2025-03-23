import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { generateAIResponse } from '../services/chatService';

const router = express.Router();

/**
 * Send a message to a chat node and get an AI response
 * POST /api/chat/:nodeId
 */
router.post('/:nodeId', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Parse the nodeId from URL parameters
    const nodeId = parseInt(req.params.nodeId);
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' });
    }

    // Ensure user is authenticated
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the message content from request body
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Fetch the node to verify ownership
    const { data: node, error: nodeError } = await supabase
      .from('chat_nodes')
      .select('owner_id, model, flavor')
      .eq('node_id', nodeId)
      .single();
    
    if (nodeError) {
      return res.status(404).json({ error: 'Chat node not found' });
    }
    
    // Check if the user is the owner
    if (node.owner_id !== userId) {
      return res.status(403).json({ error: 'Only the node owner can send messages' });
    }

    // Insert the user's message into the database
    const { error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        node_id: nodeId,
        content: message,
        is_user: true,
        timestamp: new Date().toISOString(),
      });

    if (userMessageError) {
      throw userMessageError;
    }

    // Get recent conversation history for context
    const { data: chatHistory, error: historyError } = await supabase
      .from('chat_messages')
      .select('content, is_user')
      .eq('node_id', nodeId)
      .order('timestamp', { ascending: true });

    if (historyError) {
      throw historyError;
    }

    // Generate the AI response (includes API call to LLM)
    const aiModel = node.model || 'default';
    const flavor = node.flavor || 'default';
    const aiResponse = await generateAIResponse(
      message,
      chatHistory || [],
      aiModel,
      flavor
    );

    // Insert AI response to database
    const { error: aiMessageError } = await supabase
      .from('chat_messages')
      .insert({
        node_id: nodeId,
        content: aiResponse,
        is_user: false,
        timestamp: new Date().toISOString(),
      });

    if (aiMessageError) {
      throw aiMessageError;
    }

    // Send successful response
    res.json({
      success: true,
      response: aiResponse,
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    });
  }
});

export default router; 