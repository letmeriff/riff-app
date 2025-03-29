import { supabase } from '../config/supabase';
import { 
  NodeId, 
  NodeUpdatePayload, 
  createNodeUpdatePayload 
} from '../types/messaging';

/**
 * Interface for a chat node
 */
export interface ChatNode {
  node_id: NodeId;
  user_id: string;
  owner_id: string;
  title: string;
  description?: string;
  model?: string;
  flavor?: string;
  position_x?: number;
  position_y?: number;
  created_at: string;
  updated_at?: string;
}

/**
 * Get a node by its ID
 * 
 * @param nodeId The ID of the node
 * @returns The node or null if not found
 */
export const getNode = async (nodeId: NodeId): Promise<ChatNode | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_nodes')
      .select('*')
      .eq('node_id', nodeId)
      .single();
    
    if (error) {
      console.error('Error fetching node:', error);
      return null;
    }
    
    return data as ChatNode;
  } catch (error) {
    console.error('Error in getNode:', error);
    return null;
  }
};

/**
 * Get nodes belonging to a user
 * 
 * @param userId The ID of the user
 * @returns Array of nodes or empty array if none found
 */
export const getUserNodes = async (userId: string): Promise<ChatNode[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_nodes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching user nodes:', error);
      return [];
    }
    
    return data as ChatNode[];
  } catch (error) {
    console.error('Error in getUserNodes:', error);
    return [];
  }
};

/**
 * Create a new node
 * 
 * @param userId The ID of the user creating the node
 * @param title The title of the node
 * @param params Additional node parameters
 * @returns The created node or null if creation failed
 */
export const createNode = async (
  userId: string,
  title: string,
  params: {
    description?: string;
    model?: string;
    flavor?: string;
    position_x?: number;
    position_y?: number;
  } = {}
): Promise<NodeUpdatePayload | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_nodes')
      .insert({
        user_id: userId,
        owner_id: userId,
        title,
        description: params.description,
        model: params.model,
        flavor: params.flavor,
        position_x: params.position_x || 0,
        position_y: params.position_y || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating node:', error);
      return null;
    }
    
    // Create a standardized node update payload
    return createNodeUpdatePayload({
      node_id: (data as ChatNode).node_id,
      ...(data as Record<string, unknown>)
    });
  } catch (error) {
    console.error('Error in createNode:', error);
    return null;
  }
};

/**
 * Update a node
 * 
 * @param nodeId The ID of the node to update
 * @param userId The ID of the user making the update (for ownership verification)
 * @param updates The updates to apply to the node
 * @returns The updated node payload or null if update failed
 */
export const updateNode = async (
  nodeId: NodeId,
  userId: string,
  updates: Partial<Omit<ChatNode, 'node_id' | 'user_id' | 'owner_id' | 'created_at'>>
): Promise<NodeUpdatePayload | null> => {
  try {
    // Check if user is the owner
    const { data: node, error: fetchError } = await supabase
      .from('chat_nodes')
      .select('owner_id')
      .eq('node_id', nodeId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching node for update:', fetchError);
      return null;
    }
    
    if (node.owner_id !== userId) {
      console.error('User is not the owner of the node');
      return null;
    }
    
    // Add updated_at field
    const updatedValues = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    // Update the node
    const { data, error } = await supabase
      .from('chat_nodes')
      .update(updatedValues)
      .eq('node_id', nodeId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating node:', error);
      return null;
    }
    
    // Create a standardized node update payload
    return createNodeUpdatePayload({
      node_id: (data as ChatNode).node_id,
      ...(data as Record<string, unknown>)
    });
  } catch (error) {
    console.error('Error in updateNode:', error);
    return null;
  }
};

/**
 * Update node title
 * 
 * @param nodeId The ID of the node
 * @param userId The ID of the user (for ownership verification)
 * @param title The new title
 * @returns The updated node payload or null if update failed
 */
export const updateNodeTitle = async (
  nodeId: NodeId,
  userId: string,
  title: string
): Promise<NodeUpdatePayload | null> => {
  return updateNode(nodeId, userId, { title });
};

/**
 * Update node description
 * 
 * @param nodeId The ID of the node
 * @param userId The ID of the user (for ownership verification)
 * @param description The new description
 * @returns The updated node payload or null if update failed
 */
export const updateNodeDescription = async (
  nodeId: NodeId,
  userId: string,
  description: string
): Promise<NodeUpdatePayload | null> => {
  return updateNode(nodeId, userId, { description });
};

/**
 * Delete a node
 * 
 * @param nodeId The ID of the node to delete
 * @param userId The ID of the user making the deletion (for ownership verification)
 * @returns True if the node was deleted, false otherwise
 */
export const deleteNode = async (
  nodeId: NodeId,
  userId: string
): Promise<boolean> => {
  try {
    // Check if user is the owner
    const { data: node, error: fetchError } = await supabase
      .from('chat_nodes')
      .select('owner_id')
      .eq('node_id', nodeId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching node for deletion:', fetchError);
      return false;
    }
    
    if (node.owner_id !== userId) {
      console.error('User is not the owner of the node');
      return false;
    }
    
    // Delete the node
    const { error } = await supabase
      .from('chat_nodes')
      .delete()
      .eq('node_id', nodeId);
    
    if (error) {
      console.error('Error deleting node:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteNode:', error);
    return false;
  }
}; 