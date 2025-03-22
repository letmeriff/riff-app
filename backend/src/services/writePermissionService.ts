import { supabase } from '../config/supabase';

interface WritePermission {
  currentWriter: { userId: string; email: string } | null;
  queue: { userId: string; email: string; joinedAt: string }[];
}

/**
 * Attempts to acquire write permission for a user in a node
 * 
 * @param nodeId The ID of the node
 * @param userId The ID of the user
 * @param email The email of the user
 * @returns Object containing whether permission was granted and the position in queue
 */
export const acquireWritePermission = async (
  nodeId: number,
  userId: string,
  email: string
): Promise<{ hasPermission: boolean; positionInQueue: number }> => {
  const key = `write_permission:node_${nodeId}`;
  
  try {
    // Check if the key exists in the table
    const { data: existingPermission, error: fetchError } = await supabase
      .from('key_value_store')
      .select('value')
      .eq('key', key)
      .single();

    // If there's an error but it's not a "not found" error, throw it
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // Parse existing permission data or initialize empty structure
    let permission: WritePermission = existingPermission
      ? (existingPermission.value as WritePermission)
      : { currentWriter: null, queue: [] };

    // Clean up inactive users (older than 30 seconds)
    permission.queue = permission.queue.filter(
      (entry) => new Date().getTime() - new Date(entry.joinedAt).getTime() < 30 * 1000
    );

    let hasPermission = false;
    let positionInQueue = 0;

    if (!permission.currentWriter) {
      // No current writer, assign permission to this user
      permission.currentWriter = { userId, email };
      // Remove from queue if present
      permission.queue = permission.queue.filter(entry => entry.userId !== userId);
      hasPermission = true;
    } else if (permission.currentWriter.userId === userId) {
      // User already has write permission
      hasPermission = true;
    } else {
      // Add user to queue if not already in it
      if (!permission.queue.some(entry => entry.userId === userId)) {
        permission.queue.push({
          userId,
          email,
          joinedAt: new Date().toISOString()
        });
      }
      
      // Calculate position in queue (1-based)
      positionInQueue = permission.queue.findIndex(entry => entry.userId === userId) + 1;
    }

    // Update the key_value_store table
    const { error: upsertError } = await supabase
      .from('key_value_store')
      .upsert({ key, value: permission }, { onConflict: 'key' });
    
    if (upsertError) {
      throw upsertError;
    }

    return { hasPermission, positionInQueue };
  } catch (error) {
    console.error('Error acquiring write permission:', error);
    throw error;
  }
};

/**
 * Releases write permission for a user in a node
 * 
 * @param nodeId The ID of the node
 * @param userId The ID of the user
 */
export const releaseWritePermission = async (
  nodeId: number,
  userId: string
): Promise<void> => {
  const key = `write_permission:node_${nodeId}`;
  
  try {
    // Check if the key exists in the table
    const { data: existingPermission, error: fetchError } = await supabase
      .from('key_value_store')
      .select('value')
      .eq('key', key)
      .single();

    // If there's an error but it's not a "not found" error, throw it
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // If there's no existing permission data, nothing to do
    if (!existingPermission) {
      return;
    }

    // Parse existing permission data
    let permission: WritePermission = existingPermission.value as WritePermission;

    // If the user is the current writer, pass permission to the next in queue
    if (permission.currentWriter?.userId === userId) {
      if (permission.queue.length > 0) {
        // Promote the first user in queue to be the current writer
        permission.currentWriter = {
          userId: permission.queue[0].userId,
          email: permission.queue[0].email
        };
        // Remove that user from the queue
        permission.queue.shift();
      } else {
        // No one in queue, set currentWriter to null
        permission.currentWriter = null;
      }
    } else {
      // Remove the user from the queue if they're in it
      permission.queue = permission.queue.filter(entry => entry.userId !== userId);
    }

    // If no one has write permission and queue is empty, delete the entry
    if (!permission.currentWriter && permission.queue.length === 0) {
      const { error: deleteError } = await supabase
        .from('key_value_store')
        .delete()
        .eq('key', key);
      
      if (deleteError) {
        throw deleteError;
      }
    } else {
      // Otherwise, update the entry
      const { error: upsertError } = await supabase
        .from('key_value_store')
        .upsert({ key, value: permission }, { onConflict: 'key' });
      
      if (upsertError) {
        throw upsertError;
      }
    }
  } catch (error) {
    console.error('Error releasing write permission:', error);
    throw error;
  }
};

/**
 * Gets the current write permission status for a node
 * 
 * @param nodeId The ID of the node
 * @returns Write permission data including current writer and queue
 */
export const getWritePermission = async (nodeId: number): Promise<WritePermission> => {
  const key = `write_permission:node_${nodeId}`;
  
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

    // Return the permission data or default empty structure
    return data 
      ? (data.value as WritePermission) 
      : { currentWriter: null, queue: [] };
  } catch (error) {
    console.error('Error getting write permission:', error);
    throw error;
  }
}; 