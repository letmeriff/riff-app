import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { ChatService } from '../services/chatService';
import { getUserModels } from '../services/modelService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface AttachmentReference {
  attachment_id: number;
  file_type: string;
  file_name: string;
}

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

    // Get the message content and attachments from request body
    const { message, attachments } = req.body;
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

    // Get model information
    const modelName = node.model || '';
    const modelProvider = modelName.split('/')[0];
    
    if (!modelProvider) {
      return res.status(400).json({ error: 'Invalid model configuration' });
    }
    
    // Fetch user's models to get the API key
    const userModels = await getUserModels(userId);
    const userModel = userModels.find(m => m.model_name === modelName);
    
    if (!userModel) {
      return res.status(404).json({ 
        error: `Model "${modelName}" not found in your account. Please add it in Settings.` 
      });
    }
    
    const apiKey = userModel.api_key;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: `API key not found for ${modelName}. Please update your model in Settings.` 
      });
    }
    
    // Save the message to the database 
    const { error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        node_id: nodeId,
        content: message,
        is_user: true,
        timestamp: new Date().toISOString(),
      });

    if (messageError) {
      return res.status(500).json({ error: 'Failed to save user message' });
    }

    // If attachments were sent with the message, verify they belong to this node
    let validatedAttachments: AttachmentReference[] = [];
    
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const attachmentIds = attachments.map(att => att.attachment_id);
      
      // Fetch the actual attachments to validate they exist and belong to this node
      const { data: nodeAttachments, error: attachmentError } = await supabase
        .from('chat_attachments')
        .select('attachment_id, file_type, file_name')
        .eq('node_id', nodeId)
        .in('attachment_id', attachmentIds);
      
      if (!attachmentError && nodeAttachments) {
        validatedAttachments = nodeAttachments;
      }
    }
    
    // Initialize the ChatService with message-specific attachments
    const chatService = new ChatService(
      nodeId,
      userId,
      modelName,
      apiKey,
      node.flavor,
      validatedAttachments // Pass the validated attachments to focus on
    );
    
    // Process the user message and get AI response
    const aiResponse = await chatService.processMessage(message);

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