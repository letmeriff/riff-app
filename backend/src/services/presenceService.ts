import { supabase } from '../config/supabase';
import { 
  UserPresence, 
  NodeId, 
  PresenceUpdatePayload, 
  createPresenceUpdatePayload 
} from '../types/messaging';

/**
 * Updates a user's presence in a node
 * 
 * @param nodeId The ID of the node
 * @param userId The ID of the user
 * @param email The email of the user
 * @param isTyping Whether the user is currently typing
 * @returns The updated presence information or null if an error occurred
 */
export const updateUserPresence = async (
  nodeId: NodeId,
  userId: string,
  email: string,
  isTyping: boolean
): Promise<PresenceUpdatePayload | null> => {
  const key = `presence:node_${nodeId}`;
  
  try {
    // Check if the key exists in the table
    const { data: existingPresence, error: fetchError } = await supabase
      .from('key_value_store')
      .select('value')
      .eq('key', key)
      .single();

    // If there's an error but it's not a "not found" error, throw it
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // Parse existing presence data or initialize empty array
    let presence: UserPresence[] = existingPresence
      ? (existingPresence.value as UserPresence[])
      : [];

    // Update the user's presence or add if not exists
    const userIndex = presence.findIndex((p) => p.userId === userId);
    if (userIndex !== -1) {
      presence[userIndex] = {
        userId,
        email,
        isTyping,
        lastActive: new Date().toISOString(),
      };
    } else {
      presence.push({
        userId,
        email,
        isTyping,
        lastActive: new Date().toISOString(),
      });
    }

    // Remove users who haven't been active for 30 seconds
    presence = presence.filter(
      (p) => new Date().getTime() - new Date(p.lastActive).getTime() < 30 * 1000
    );

    // Upsert the key-value pair
    const { error: upsertError } = await supabase
      .from('key_value_store')
      .upsert({ key, value: presence }, { onConflict: 'key' });
    
    if (upsertError) {
      throw upsertError;
    }
    
    // Return the standardized presence update payload
    return createPresenceUpdatePayload(nodeId, presence);
  } catch (error) {
    console.error('Error updating user presence:', error);
    return null;
  }
};

/**
 * Removes a user from a node's presence list
 * 
 * @param nodeId The ID of the node
 * @param userId The ID of the user
 * @returns The updated presence information or null if an error occurred
 */
export const removeUserPresence = async (
  nodeId: NodeId,
  userId: string
): Promise<PresenceUpdatePayload | null> => {
  const key = `presence:node_${nodeId}`;
  
  try {
    // Check if the key exists in the table
    const { data: existingPresence, error: fetchError } = await supabase
      .from('key_value_store')
      .select('value')
      .eq('key', key)
      .single();

    // If there's an error but it's not a "not found" error, throw it
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // If there's no existing presence data, return empty array
    if (!existingPresence) {
      return createPresenceUpdatePayload(nodeId, []);
    }

    // Parse existing presence data
    let presence: UserPresence[] = existingPresence.value as UserPresence[];

    // Remove the user from the presence list
    presence = presence.filter((p) => p.userId !== userId);

    // If no users are left, delete the key
    if (presence.length === 0) {
      const { error: deleteError } = await supabase
        .from('key_value_store')
        .delete()
        .eq('key', key);
      
      if (deleteError) {
        throw deleteError;
      }
    } else {
      // Otherwise, update the presence list
      const { error: upsertError } = await supabase
        .from('key_value_store')
        .upsert({ key, value: presence }, { onConflict: 'key' });
      
      if (upsertError) {
        throw upsertError;
      }
    }
    
    // Return the standardized presence update payload
    return createPresenceUpdatePayload(nodeId, presence);
  } catch (error) {
    console.error('Error removing user presence:', error);
    return null;
  }
};

/**
 * Gets the list of users present in a node
 * 
 * @param nodeId The ID of the node
 * @returns The presence update payload or null if an error occurred
 */
export const getUserPresence = async (nodeId: NodeId): Promise<PresenceUpdatePayload | null> => {
  const key = `presence:node_${nodeId}`;
  
  try {
    // Check if the key exists in the table
    const { data, error } = await supabase
      .from('key_value_store')
      .select('value')
      .eq('key', key)
      .single();

    // If there's an error but it's not a "not found" error, throw it
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Get presence data or empty array
    const presence = data ? (data.value as UserPresence[]) : [];
    
    // Return the standardized presence update payload
    return createPresenceUpdatePayload(nodeId, presence);
  } catch (error) {
    console.error('Error getting user presence:', error);
    return null;
  }
}; 