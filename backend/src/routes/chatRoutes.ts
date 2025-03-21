import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ChatService } from '../services/chatService';
import { getUserModels } from '../services/modelService';

const router = express.Router();

router.post('/:nodeId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const nodeId = parseInt(req.params.nodeId);
    const { message, modelName } = req.body;

    if (!message || !modelName) {
      return res.status(400).json({ error: 'message and modelName are required' });
    }

    // Fetch the user's model configuration
    const userModels = await getUserModels(userId);
    const modelConfig = userModels.find((m) => m.model_name === modelName);
    if (!modelConfig) {
      return res.status(404).json({ error: `Model ${modelName} not found for user` });
    }

    // Initialize the ChatService
    const chatService = new ChatService(nodeId, userId, modelName, modelConfig.api_key);

    // Process the message
    const aiResponse = await chatService.processMessage(message);
    res.json({ response: aiResponse });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
});

export default router; 