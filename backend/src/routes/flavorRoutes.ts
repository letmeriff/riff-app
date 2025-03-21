import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getFlavors } from '../services/flavorService';

const router = express.Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const flavors = await getFlavors();
    res.json(flavors);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: errorMessage });
  }
});

export default router; 