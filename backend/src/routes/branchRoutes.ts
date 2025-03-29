import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createContextPull } from '../services/contextPullService';
import { supabase } from '../config/supabase';

const router = express.Router();

/**
 * Branch a node to create a new node with the same history, model, and flavor
 * POST /api/branch
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Ensure user is authenticated
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { originNodeId } = req.body;

    if (!originNodeId) {
      return res.status(400).json({ error: 'originNodeId is required' });
    }

    // Fetch the original node's details
    const { data: originNode, error: nodeError } = await supabase
      .from('chat_nodes')
      .select('title, model, flavor')
      .eq('node_id', originNodeId)
      .single();
    
    if (nodeError || !originNode) {
      return res.status(404).json({ error: 'Origin node not found' });
    }

    // Create a new node with the same model and flavor
    const { data: newNode, error: newNodeError } = await supabase
      .from('chat_nodes')
      .insert({
        user_id: userId,
        owner_id: userId,
        title: `${originNode.title} (Branched)`,
        model: originNode.model,
        flavor: originNode.flavor,
      })
      .select()
      .single();
    
    if (newNodeError) {
      console.error('Error creating branched node:', newNodeError);
      return res.status(500).json({ error: 'Failed to create branched node' });
    }

    // Copy the chat history from the origin node to the new node
    const { data: originMessages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('node_id', originNodeId)
      .order('timestamp', { ascending: true });
    
    if (messagesError) {
      console.error('Error fetching origin messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch origin messages' });
    }

    if (originMessages && originMessages.length > 0) {
      // Map the messages to the new node
      const newMessages = originMessages.map((msg) => ({
        node_id: newNode.node_id,
        content: msg.content,
        is_user: msg.is_user,
        timestamp: msg.timestamp,
      }));
      
      // Insert the messages into the new node
      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert(newMessages);
      
      if (insertError) {
        console.error('Error copying messages to branched node:', insertError);
        return res.status(500).json({ error: 'Failed to copy messages to branched node' });
      }
    }

    // Set up a context pull relationship so the new node pulls from the origin node
    try {
      await createContextPull(newNode.node_id, originNodeId);
    } catch (error) {
      console.error('Error creating context pull relationship:', error);
      // We'll continue even if this fails, as the node is already created
    }

    // Add a placeholder message to indicate this is a branched node
    const { error: placeholderError } = await supabase
      .from('chat_messages')
      .insert({
        node_id: newNode.node_id,
        content: `This node was branched from Node ${originNodeId}. It will automatically pull new context from the original node.`,
        is_user: false,
        timestamp: new Date().toISOString(),
      });
    
    if (placeholderError) {
      console.error('Error adding placeholder message:', placeholderError);
      // Continue even if this fails
    }

    res.json({ 
      success: true,
      newNodeId: newNode.node_id,
      message: `Successfully branched node ${originNodeId} to create node ${newNode.node_id}` 
    });
  } catch (error: unknown) {
    console.error('Error branching node:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to branch node' 
    });
  }
});

export default router; 