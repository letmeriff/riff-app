import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { SummarizationService } from '../services/summarizationService';
import { getUserModels } from '../services/modelService';
import { supabase } from '../config/supabase';

const router = express.Router();

router.post('/:nodeId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const nodeId = parseInt(req.params.nodeId);

    // Fetch the node's model (we'll use the same model for summarization)
    const { data: node, error: nodeError } = await supabase
      .from('chat_nodes')
      .select('model, owner_id')
      .eq('node_id', nodeId)
      .single();
    if (nodeError || !node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // No need to check for ownership - RLS will handle access control
    // Users can summarize a node if they can access it according to RLS policies

    const modelName = node.model;
    if (!modelName) {
      return res.status(400).json({ error: 'Node is missing model' });
    }

    // Fetch the user's model configuration - use node owner's configuration for non-owners
    let userModels;
    if (userId === node.owner_id) {
      userModels = await getUserModels(userId);
    } else {
      userModels = await getUserModels(node.owner_id);
    }

    const modelConfig = userModels.find((m) => m.model_name === modelName);
    if (!modelConfig) {
      return res.status(404).json({ error: `Model ${modelName} not found for user` });
    }

    // Summarize the chat history
    const summarizationService = new SummarizationService(modelName, modelConfig.api_key);
    const summary = await summarizationService.summarizeChatHistory(nodeId);

    res.json({ summary });
  } catch (error: unknown) {
    console.error('Error summarizing chat history:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to summarize chat history' 
    });
  }
});

export default router; 