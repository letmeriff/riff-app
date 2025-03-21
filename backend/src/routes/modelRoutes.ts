import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getUserModels, addUserModel, deleteUserModel } from '../services/modelService';

const router = express.Router();

// Get all models for the authenticated user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    // User ID is attached by the authMiddleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const models = await getUserModels(userId);
    res.json(models);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
});

// Add a new model configuration
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { model_name, api_key } = req.body;
    if (!model_name || !api_key) {
      return res.status(400).json({ error: 'model_name and api_key are required' });
    }
    const newModel = await addUserModel(userId, model_name, api_key);
    res.status(201).json(newModel);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
});

// Delete a model configuration
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const modelId = parseInt(req.params.id);
    await deleteUserModel(modelId);
    res.status(204).send();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
});

export default router; 