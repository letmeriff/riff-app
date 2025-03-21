import { supabase } from './supabase';

export interface ChatNode {
  node_id: number;
  title: string;
  user_id: string;
  model?: string;
  flavor?: string;
  created_at: string;
}

export const createNode = async (
  userId: string, 
  title: string,
  model?: string,
  flavor?: string
): Promise<ChatNode> => {
  const { data, error } = await supabase
    .from('chat_nodes')
    .insert({ 
      user_id: userId, 
      title,
      model,
      flavor
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchNodes = async (userId: string): Promise<ChatNode[]> => {
  const { data, error } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data;
};

export const deleteNode = async (nodeId: number): Promise<void> => {
  const { error } = await supabase.from('chat_nodes').delete().eq('node_id', nodeId);
  if (error) throw error;
}; 