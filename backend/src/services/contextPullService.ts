import { supabase } from '../config/supabase';

export interface ContextPull {
  id: number;
  target_node_id: number;
  origin_node_id: number;
  last_pulled_at: string;
  created_at: string;
}

/**
 * Create a new context pull relationship
 */
export const createContextPull = async (
  targetNodeId: number, 
  originNodeId: number
): Promise<ContextPull> => {
  const { data, error } = await supabase
    .from('context_pulls')
    .insert({ 
      target_node_id: targetNodeId, 
      origin_node_id: originNodeId 
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Update the last_pulled_at timestamp for an existing context pull
 */
export const updateContextPull = async (pullId: number): Promise<ContextPull> => {
  const { data, error } = await supabase
    .from('context_pulls')
    .update({ last_pulled_at: new Date().toISOString() })
    .eq('id', pullId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

/**
 * Get an existing context pull by target and origin node IDs
 */
export const getContextPullByNodes = async (
  targetNodeId: number,
  originNodeId: number
): Promise<ContextPull | null> => {
  const { data, error } = await supabase
    .from('context_pulls')
    .select('*')
    .eq('target_node_id', targetNodeId)
    .eq('origin_node_id', originNodeId)
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

/**
 * Check if there are updates in the origin node since last pull
 */
export const checkForUpdates = async (contextPull: ContextPull): Promise<boolean> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('timestamp')
    .eq('node_id', contextPull.origin_node_id)
    .gt('timestamp', contextPull.last_pulled_at)
    .limit(1);
  
  if (error) throw error;
  return data && data.length > 0;
}; 