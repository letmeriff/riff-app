import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { 
    transferNodeOwnership, 
    getOwnershipInfo, 
    isNodeOwner 
} from '../services/ownershipService';
import { NodeId } from '../types/messaging';

const router = express.Router();

/**
 * Get the ownership information for a node
 * GET /api/ownership/:nodeId
 */
router.get('/:nodeId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const nodeId: NodeId = parseInt(req.params.nodeId);
        
        if (isNaN(nodeId)) {
            return res.status(400).json({ error: 'Invalid node ID' });
        }
        
        const ownershipPayload = await getOwnershipInfo(nodeId);
        
        if (!ownershipPayload) {
            return res.status(404).json({ error: 'Node not found or ownership information unavailable' });
        }
        
        res.json(ownershipPayload);
    } catch (error) {
        console.error('Error getting ownership info:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});

/**
 * Transfer ownership of a node to a new owner
 * POST /api/ownership/transfer
 * Body: { nodeId: number, newOwnerId: string }
 */
router.post('/transfer', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { nodeId: nodeIdParam, newOwnerId } = req.body;
        const nodeId: NodeId = parseInt(nodeIdParam);
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (isNaN(nodeId)) {
            return res.status(400).json({ error: 'Invalid node ID' });
        }
        
        if (!newOwnerId || typeof newOwnerId !== 'string') {
            return res.status(400).json({ error: 'Valid new owner ID is required' });
        }
        
        // Perform the ownership transfer
        const result = await transferNodeOwnership(nodeId, userId, newOwnerId);
        
        if (!result.success) {
            // If there was an error, return the error payload in a structured response
            return res.status(400).json({
                success: false,
                error: (result.payload as any).error || 'Failed to transfer ownership',
                payload: result.payload
            });
        }
        
        // Return the successful ownership update payload
        res.json({
            success: true,
            payload: result.payload
        });
    } catch (error) {
        console.error('Error transferring ownership:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});

/**
 * Check if the current user is the owner of a node
 * GET /api/ownership/check/:nodeId
 */
router.get('/check/:nodeId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const nodeId: NodeId = parseInt(req.params.nodeId);
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (isNaN(nodeId)) {
            return res.status(400).json({ error: 'Invalid node ID' });
        }
        
        const isOwner = await isNodeOwner(nodeId, userId);
        
        res.json({ isOwner });
    } catch (error) {
        console.error('Error checking ownership:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'An unknown error occurred'
        });
    }
});

export default router; 