import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { io } from '../index';

const router = express.Router();

// Get attachments for a specific node
router.get('/:nodeId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;

    if (!nodeId) {
      return res.status(400).json({ error: 'Node ID is required' });
    }

    const { data, error } = await supabase
      .from('chat_attachments')
      .select('*')
      .eq('node_id', parseInt(nodeId))
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    // Enhance data with signed URLs that work with private buckets
    const enhancedData = await Promise.all(data.map(async attachment => {
      // Use existing URL if it's already saved in the database
      if (attachment.file_url) {
        return attachment;
      }
      
      // Create a signed URL with 1 year expiry
      const { data: urlData } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(attachment.file_path, 60 * 60 * 24 * 365);
      
      return {
        ...attachment,
        file_url: urlData?.signedUrl || null
      };
    }));

    return res.json(enhancedData);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch attachments',
    });
  }
});

// Delete an attachment
router.delete('/:attachmentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user?.id;

    if (!attachmentId) {
      return res.status(400).json({ error: 'Attachment ID is required' });
    }

    // Get the attachment details
    const { data: attachment, error: fetchError } = await supabase
      .from('chat_attachments')
      .select('*, chat_nodes!inner(owner_id)')
      .eq('attachment_id', parseInt(attachmentId))
      .single();

    if (fetchError || !attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Check if user is the owner of the node or the one who uploaded the attachment
    const isNodeOwner = attachment.chat_nodes.owner_id === userId;
    const isUploader = attachment.user_id === userId;

    if (!isNodeOwner && !isUploader) {
      return res.status(403).json({ error: 'Not authorized to delete this attachment' });
    }

    // Delete the file from storage
    const { error: storageError } = await supabase.storage
      .from('chat-attachments')
      .remove([attachment.file_path]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      // Continue with deleting the record even if file deletion fails
    }

    // Delete the attachment record
    const { error: deleteError } = await supabase
      .from('chat_attachments')
      .delete()
      .eq('attachment_id', parseInt(attachmentId));

    if (deleteError) {
      throw deleteError;
    }

    // Notify clients about the deletion
    const nodeRoom = `node:${attachment.node_id}`;
    io.to(nodeRoom).emit('attachment-delete', { 
      nodeId: attachment.node_id, 
      attachmentId: parseInt(attachmentId) 
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to delete attachment',
    });
  }
});

export default router; 