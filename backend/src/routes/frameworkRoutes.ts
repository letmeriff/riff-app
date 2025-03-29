import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../config/supabase';

const router = express.Router();

// Get all frameworks
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('frameworks')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching frameworks:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
  }
});

export default router; 