import { supabase } from '../config/supabase';
import { 
    NodeId, 
    OwnershipUpdatePayload, 
    TransferErrorPayload, 
    createOwnershipUpdatePayload, 
    createTransferErrorPayload 
} from '../types/messaging';

/**
 * Transfers ownership of a node to a new owner
 * 
 * @param nodeId The ID of the node
 * @param currentOwnerId The ID of the current owner
 * @param newOwnerId The ID of the new owner
 * @returns The ownership update payload or a transfer error payload on failure
 */
export const transferNodeOwnership = async (
    nodeId: NodeId,
    currentOwnerId: string,
    newOwnerId: string
): Promise<{ success: boolean; payload: OwnershipUpdatePayload | TransferErrorPayload }> => {
    try {
        // Verify the current user is the owner
        const { data: node, error } = await supabase
            .from('chat_nodes')
            .select('owner_id')
            .eq('node_id', nodeId)
            .single();
        
        if (error) {
            console.error('Error fetching node owner:', error);
            return { 
                success: false, 
                payload: createTransferErrorPayload(nodeId, 'Failed to fetch node information') 
            };
        }
        
        if (node.owner_id !== currentOwnerId) {
            return { 
                success: false, 
                payload: createTransferErrorPayload(nodeId, 'Only the current owner can transfer ownership') 
            };
        }
        
        // Transfer ownership
        const { error: updateError } = await supabase
            .from('chat_nodes')
            .update({ owner_id: newOwnerId })
            .eq('node_id', nodeId);
        
        if (updateError) {
            console.error('Error updating node owner:', updateError);
            return { 
                success: false, 
                payload: createTransferErrorPayload(nodeId, 'Failed to transfer ownership') 
            };
        }
        
        // Return success with ownership update payload
        return { 
            success: true, 
            payload: createOwnershipUpdatePayload(nodeId, newOwnerId) 
        };
    } catch (error) {
        console.error('Error handling ownership transfer:', error);
        return { 
            success: false, 
            payload: createTransferErrorPayload(
                nodeId, 
                error instanceof Error ? error.message : 'Unknown error'
            ) 
        };
    }
};

/**
 * Checks if a user is the owner of a node
 * 
 * @param nodeId The ID of the node
 * @param userId The ID of the user
 * @returns True if the user is the owner, false otherwise
 */
export const isNodeOwner = async (nodeId: NodeId, userId: string): Promise<boolean> => {
    try {
        const { data: node, error } = await supabase
            .from('chat_nodes')
            .select('owner_id')
            .eq('node_id', nodeId)
            .single();
        
        if (error) {
            console.error('Error checking node ownership:', error);
            return false;
        }
        
        return node.owner_id === userId;
    } catch (error) {
        console.error('Error in isNodeOwner:', error);
        return false;
    }
};

/**
 * Gets the current owner of a node
 * 
 * @param nodeId The ID of the node
 * @returns The ID of the node owner or null on failure
 */
export const getNodeOwner = async (nodeId: NodeId): Promise<string | null> => {
    try {
        const { data: node, error } = await supabase
            .from('chat_nodes')
            .select('owner_id')
            .eq('node_id', nodeId)
            .single();
        
        if (error) {
            console.error('Error getting node owner:', error);
            return null;
        }
        
        return node.owner_id;
    } catch (error) {
        console.error('Error in getNodeOwner:', error);
        return null;
    }
};

/**
 * Creates an ownership update payload for a node
 * 
 * @param nodeId The ID of the node
 * @returns The ownership update payload or null on failure
 */
export const getOwnershipInfo = async (nodeId: NodeId): Promise<OwnershipUpdatePayload | null> => {
    try {
        const ownerId = await getNodeOwner(nodeId);
        
        if (!ownerId) {
            return null;
        }
        
        return createOwnershipUpdatePayload(nodeId, ownerId);
    } catch (error) {
        console.error('Error getting ownership info:', error);
        return null;
    }
}; 