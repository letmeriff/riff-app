import express, { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Get all prompts or filter by type
router.get('/', async (req: Request, res: Response) => {
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
    
    // Map the database fields to the frontend expected format
    const mappedPrompts = data.map(prompt => ({
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      type: prompt.type,
      content: prompt.prompt, // Map 'prompt' field to 'content'
      created_at: prompt.created_at
    }));
    
    res.json({ 
      prompts: mappedPrompts 
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch prompts' 
    });
  }
});

// Get a single prompt by ID
router.get('/:id', async (req: Request, res: Response) => {
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
    
    // Map the database fields to the frontend expected format
    const mappedPrompt = {
      id: data.id,
      name: data.name,
      description: data.description,
      type: data.type,
      content: data.prompt, // Map 'prompt' field to 'content'
      created_at: data.created_at
    };
    
    res.json({ 
      prompt: mappedPrompt 
    });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch prompt' 
    });
  }
});

export default router; 