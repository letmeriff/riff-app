import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ChatService } from '../services/chatService';
import { getUserModels } from '../services/modelService';
import { supabase } from '../config/supabase';

const router = express.Router();

router.post('/:nodeId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const nodeId = parseInt(req.params.nodeId);
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Fetch the node's model and flavor
    const { data: node, error: nodeError } = await supabase
      .from('chat_nodes')
      .select('model, flavor')
      .eq('node_id', nodeId)
      .single();

    if (nodeError) {
      return res.status(404).json({ error: 'Node not found' });
    }

    if (!node || !node.model) {
      return res.status(400).json({ error: 'Node is missing model configuration' });
    }

    const modelName = node.model;
    const flavorName = node.flavor;

    // Fetch the user's model configuration
    const userModels = await getUserModels(userId);
    const modelConfig = userModels.find((m) => m.model_name === modelName);
    if (!modelConfig) {
      return res.status(404).json({ error: `Model ${modelName} not found for user` });
    }

    // Initialize the ChatService with the model and flavor
    const chatService = new ChatService(
      nodeId, 
      userId, 
      modelName, 
      modelConfig.api_key,
      flavorName
    );

    // Process the message
    const aiResponse = await chatService.processMessage(message);
    res.json({ response: aiResponse });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
});

export default router; 