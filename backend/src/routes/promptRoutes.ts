import express, { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Get all prompts or filter by type
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    let query = supabase.from('prompts').select('*');
    
    if (type === 'framework' || type === 'template') {
      query = query.eq('type', type);
    }
    
    const { data, error } = await query.order('name');
    
    if (error) {
      throw error;
    }
    
    res.json({ 
      prompts: data 
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch prompts' 
    });
  }
});

// Get a single prompt by ID
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Prompt not found' });
      }
      throw error;
    }
    
    res.json({ 
      prompt: data 
    });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch prompt' 
    });
  }
});

export default router; 