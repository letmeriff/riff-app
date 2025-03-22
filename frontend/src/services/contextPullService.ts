import { supabase } from './supabase';

export interface ContextPull {
  id: number;
  target_node_id: number;
  origin_node_id: number;
  last_pulled_at: string;
  created_at: string;
}

export const createContextPull = async (
  targetNodeId: number,
  originNodeId: number
): Promise<ContextPull> => {
  const { data, error } = await supabase
    .from('context_pulls')
    .insert({ target_node_id: targetNodeId, origin_node_id: originNodeId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

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

export const getContextPullsForNode = async (nodeId: number): Promise<ContextPull[]> => {
  const { data, error } = await supabase
    .from('context_pulls')
    .select('*')
    .eq('target_node_id', nodeId);
  if (error) throw error;
  return data || [];
};

export const getNodesPullingFromNode = async (nodeId: number): Promise<ContextPull[]> => {
  const { data, error } = await supabase
    .from('context_pulls')
    .select('*')
    .eq('origin_node_id', nodeId);
  if (error) throw error;
  return data || [];
}; 