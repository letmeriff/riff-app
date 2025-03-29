import { supabase } from './supabase';

export interface ChatNode {
  node_id: number;
  title: string;
  user_id: string;
  owner_id: string;
  model?: string;
  flavor?: string;
  position_x?: number;
  position_y?: number;
  created_at: string;
  description?: string;
  position_updated_at?: string;
}

export interface SupabasePayload<T> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: T;
  old?: T;
}

export const createNode = async (
  userId: string, 
  title: string,
  model?: string,
  flavor?: string,
  description?: string
): Promise<ChatNode> => {
  const initialPositionX = Math.random() * 500;
  const initialPositionY = Math.random() * 500;

  const { data, error } = await supabase
    .from('chat_nodes')
    .insert({ 
      user_id: userId,
      owner_id: userId,
      title,
      model,
      flavor,
      position_x: initialPositionX,
      position_y: initialPositionY,
      description: description || 'No description available.'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchNodes = async (): Promise<ChatNode[]> => {
  const { data, error } = await supabase
    .from('chat_nodes')
    .select('*');
  if (error) throw error;
  return data;
};

export const deleteNode = async (nodeId: number): Promise<void> => {
  const { error } = await supabase.from('chat_nodes').delete().eq('node_id', nodeId);
  if (error) throw error;
};

export const updateNodePosition = async (
  nodeId: number, 
  position: { x: number; y: number }
): Promise<{ 
  success: boolean; 
  data?: any;
}> => {
  // Ensure we have valid numbers for positions
  const validX = isNaN(position.x) ? 0 : position.x;
  const validY = isNaN(position.y) ? 0 : position.y;
  
  try {
    console.log(`Saving position to database for node ${nodeId}: x=${validX}, y=${validY}`);
    
    // Simple direct update - Yjs handles all conflict resolution
    const { data, error } = await supabase
      .from('chat_nodes')
      .update({ 
        position_x: validX, 
        position_y: validY 
      })
      .eq('node_id', nodeId)
      .select();
    
    if (error) {
      console.error(`Error updating node position in database:`, error);
      throw error;
    }
    
    console.log(`Position update successful for node ${nodeId}. DB returned:`, data);
    
    return { success: true, data };
  } catch (error) {
    console.error(`Failed to update node position:`, error);
    return { success: false };
  }
};

export const transferOwnership = async (nodeId: number, newOwnerId: string): Promise<void> => {
  const { error } = await supabase
    .from('chat_nodes')
    .update({ owner_id: newOwnerId })
    .eq('node_id', nodeId);
  if (error) throw error;
};

export const updateNodeTitle = async (nodeId: number, title: string): Promise<void> => {
  const { error } = await supabase
    .from('chat_nodes')
    .update({ title })
    .eq('node_id', nodeId);
  if (error) throw error;
};

export const updateNodeDescription = async (nodeId: number, description: string): Promise<void> => {
  const { error } = await supabase
    .from('chat_nodes')
    .update({ description })
    .eq('node_id', nodeId);
  if (error) throw error;
};

// Add function to fetch node position history
export const getNodePositionHistory = async (
  nodeId: number, 
  limit = 20
): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('node_position_history')
      .select('*')
      .eq('node_id', nodeId)
      .order('lamport_timestamp', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error(`Error fetching node position history:`, error);
    return [];
  }
};

// Alias for consistency in naming
export const fetchNodePositionHistory = getNodePositionHistory; 