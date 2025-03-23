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
  flavor?: string
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
      position_y: initialPositionY
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

export const updateNodePosition = async (nodeId: number, position: { x: number; y: number }): Promise<void> => {
  const { error } = await supabase
    .from('chat_nodes')
    .update({ position_x: position.x, position_y: position.y })
    .eq('node_id', nodeId);
  if (error) throw error;
};

export const transferOwnership = async (nodeId: number, newOwnerId: string): Promise<void> => {
  const { error } = await supabase
    .from('chat_nodes')
    .update({ owner_id: newOwnerId })
    .eq('node_id', nodeId);
  if (error) throw error;
}; 