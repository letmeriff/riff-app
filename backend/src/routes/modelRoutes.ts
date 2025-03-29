import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getUserModels, addUserModel, deleteUserModel } from '../services/modelService';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';

const router = express.Router();

/**
 * Validates an API key by making a test request to the LLM provider
 * @param modelName The model name (e.g., 'openai/gpt-4', 'anthropic/claude-3')
 * @param apiKey The API key to validate
 * @returns A boolean indicating whether the key is valid
 */
const validateApiKey = async (modelName: string, apiKey: string): Promise<boolean> => {
  try {
    if (modelName.startsWith('openai/')) {
      const model = new ChatOpenAI({
        modelName: modelName.split('/')[1] || 'gpt-3.5-turbo', // Default to gpt-3.5-turbo if no model specified
        apiKey: apiKey,
        temperature: 0,
      });
      // Make a minimal test request
      await model.invoke([new HumanMessage('Hello')]);
      return true;
    } else if (modelName.startsWith('anthropic/')) {
      const model = new ChatAnthropic({
        modelName: modelName.split('/')[1] || 'claude-3-sonnet-20240229', // Default to claude-3-sonnet if no model specified
        apiKey: apiKey,
        temperature: 0,
      });
      await model.invoke([new HumanMessage('Hello')]);
      return true;
    }
    return false;
  } catch (error) {
    console.error('API key validation failed:', error);
    return false;
  }
};

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

    // Validate the API key before adding
    const isValid = await validateApiKey(model_name, api_key);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid API key or unsupported model' });
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