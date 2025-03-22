import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { getUserPresence } from '../services/presenceService';

const router = express.Router();

/**
 * Get the presence information for a specific node
 * GET /api/presence/:nodeId
 */
router.get('/:nodeId', authMiddleware, async (req, res) => {
  try {
    const nodeId = parseInt(req.params.nodeId);
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' });
    }

    const presence = await getUserPresence(nodeId);
    res.json(presence);
  } catch (error) {
    console.error('Error getting presence:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    });
  }
});

export default router; 