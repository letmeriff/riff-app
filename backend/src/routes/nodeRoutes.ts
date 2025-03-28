import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { 
  getNode, 
  getUserNodes, 
  createNode, 
  updateNode, 
  updateNodeTitle, 
  updateNodeDescription, 
  deleteNode 
} from '../services/nodeService';
import { io } from '../index';
import { NodeId } from '../types/messaging';

const router = express.Router();

/**
 * Get all nodes belonging to the authenticated user
 * GET /api/nodes
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const nodes = await getUserNodes(userId);
    
    res.json(nodes);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * Get a specific node by ID
 * GET /api/nodes/:nodeId
 */
router.get('/:nodeId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const nodeId: NodeId = parseInt(req.params.nodeId);
    
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' });
    }
    
    const node = await getNode(nodeId);
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    res.json(node);
  } catch (error) {
    console.error('Error fetching node:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * Create a new node
 * POST /api/nodes
 * Body: { title: string, description?: string, model?: string, flavor?: string, position_x?: number, position_y?: number }
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { title, description, model, flavor, position_x, position_y } = req.body;
    
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const nodePayload = await createNode(userId, title, {
      description,
      model,
      flavor,
      position_x,
      position_y
    });
    
    if (!nodePayload) {
      return res.status(500).json({ error: 'Failed to create node' });
    }
    
    // Emit node creation event
    io.emit('node-update', {
      eventType: 'INSERT',
      new: nodePayload.new,
      old: null
    });
    
    res.status(201).json({
      success: true,
      payload: nodePayload
    });
  } catch (error) {
    console.error('Error creating node:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * Update a node
 * PUT /api/nodes/:nodeId
 * Body: { title?: string, description?: string, model?: string, flavor?: string }
 */
router.put('/:nodeId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const nodeId: NodeId = parseInt(req.params.nodeId);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' });
    }
    
    const { title, description, model, flavor } = req.body;
    
    // At least one update field is required
    if (!title && !description && !model && !flavor) {
      return res.status(400).json({ error: 'At least one update field is required' });
    }
    
    const updates: Record<string, any> = {};
    
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (model !== undefined) updates.model = model;
    if (flavor !== undefined) updates.flavor = flavor;
    
    const nodePayload = await updateNode(nodeId, userId, updates);
    
    if (!nodePayload) {
      return res.status(404).json({ error: 'Node not found or you are not the owner' });
    }
    
    // Emit node update event to specific node room
    const nodeRoom = `node:${nodeId}`;
    io.to(nodeRoom).emit('node-update', {
      eventType: 'UPDATE',
      new: nodePayload.new,
      old: null
    });
    
    res.json({
      success: true,
      payload: nodePayload
    });
  } catch (error) {
    console.error('Error updating node:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * Update node title
 * PATCH /api/nodes/:nodeId/title
 * Body: { title: string }
 */
router.patch('/:nodeId/title', authMiddleware, async (req: Request, res: Response) => {
  try {
    const nodeId: NodeId = parseInt(req.params.nodeId);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' });
    }
    
    const { title } = req.body;
    
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Valid title is required' });
    }
    
    const nodePayload = await updateNodeTitle(nodeId, userId, title);
    
    if (!nodePayload) {
      return res.status(404).json({ error: 'Node not found or you are not the owner' });
    }
    
    // Emit node update event to specific node room
    const nodeRoom = `node:${nodeId}`;
    io.to(nodeRoom).emit('node-update', {
      eventType: 'UPDATE',
      new: nodePayload.new,
      old: null
    });
    
    res.json({
      success: true,
      payload: nodePayload
    });
  } catch (error) {
    console.error('Error updating node title:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * Update node description
 * PATCH /api/nodes/:nodeId/description
 * Body: { description: string }
 */
router.patch('/:nodeId/description', authMiddleware, async (req: Request, res: Response) => {
  try {
    const nodeId: NodeId = parseInt(req.params.nodeId);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' });
    }
    
    const { description } = req.body;
    
    if (typeof description !== 'string') {
      return res.status(400).json({ error: 'Valid description is required' });
    }
    
    const nodePayload = await updateNodeDescription(nodeId, userId, description);
    
    if (!nodePayload) {
      return res.status(404).json({ error: 'Node not found or you are not the owner' });
    }
    
    // Emit node update event to specific node room
    const nodeRoom = `node:${nodeId}`;
    io.to(nodeRoom).emit('node-update', {
      eventType: 'UPDATE',
      new: nodePayload.new,
      old: null
    });
    
    res.json({
      success: true,
      payload: nodePayload
    });
  } catch (error) {
    console.error('Error updating node description:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * Delete a node
 * DELETE /api/nodes/:nodeId
 */
router.delete('/:nodeId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const nodeId: NodeId = parseInt(req.params.nodeId);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' });
    }
    
    const success = await deleteNode(nodeId, userId);
    
    if (!success) {
      return res.status(404).json({ error: 'Node not found or you are not the owner' });
    }
    
    // Emit node deletion event
    io.emit('node-update', {
      eventType: 'DELETE',
      new: null,
      old: { node_id: nodeId }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting node:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

export default router; 