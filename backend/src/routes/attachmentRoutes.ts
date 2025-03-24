import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { io } from '../index';
import { extractTextFromPDF } from '../utils/pdfExtractor';

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

// Upload file with content extraction
router.post('/upload', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { nodeId, fileData, fileName, fileType, fileSize } = req.body;

    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    if (!fileData || !fileName || !fileType || !fileSize) {
      return res.status(400).json({ error: 'fileData, fileName, fileType, and fileSize are required' });
    }

    // Check if the user is the owner of the node
    const { data: node, error: nodeError } = await supabase
      .from('chat_nodes')
      .select('owner_id')
      .eq('node_id', nodeId)
      .single();
    
    if (nodeError || !node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    if (node.owner_id !== userId) {
      return res.status(403).json({ error: 'Only the node owner can upload attachments' });
    }

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(fileData, 'base64');
    const filePath = `${nodeId}/${Date.now()}-${fileName.replace(/\s+/g, '_')}`;

    // Upload the file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, fileBuffer, { contentType: fileType });
    
    if (uploadError) {
      throw uploadError;
    }

    // Create a signed URL for the file (works with private buckets)
    const { data: urlData } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry
    
    const signedUrl = urlData?.signedUrl;
    
    if (!signedUrl) {
      throw new Error('Failed to create signed URL for the uploaded file');
    }

    // Extract text if the file is a PDF
    let extractedContent: string | null = null;
    if (fileType === 'application/pdf') {
      try {
        extractedContent = await extractTextFromPDF(fileBuffer);
      } catch (extractError) {
        console.error('Error extracting PDF content:', extractError);
        // Continue with the file upload even if extraction fails
      }
    }

    // Store the file metadata in the database
    let { data: attachment, error: insertError } = await supabase
      .from('chat_attachments')
      .insert({
        node_id: nodeId,
        user_id: userId,
        file_path: filePath,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        file_url: signedUrl,
        ...(extractedContent !== null && { extracted_content: extractedContent }) // Conditionally include extracted_content
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error inserting attachment:', insertError);
      
      // If the error is related to extracted_content column not existing, try without it
      if (insertError.message?.includes('extracted_content') || insertError.code === '42703') {
        console.log('Retrying without extracted_content column');
        
        const { data: fallbackAttachment, error: fallbackError } = await supabase
          .from('chat_attachments')
          .insert({
            node_id: nodeId,
            user_id: userId,
            file_path: filePath,
            file_name: fileName,
            file_type: fileType,
            file_size: fileSize,
            file_url: signedUrl
          })
          .select()
          .single();
          
        if (fallbackError) {
          throw fallbackError;
        }
        
        attachment = fallbackAttachment;
      } else {
        throw insertError;
      }
    }

    // Broadcast the new attachment to all users in the node room
    const nodeRoom = `node:${nodeId}`;
    io.to(nodeRoom).emit('attachment-update', { 
      nodeId, 
      attachment 
    });

    // Update the node state with attachment info
    const { data: nodeAttachments } = await supabase
      .from('chat_attachments')
      .select('*')
      .eq('node_id', nodeId);
    
    const attachments = await Promise.all((nodeAttachments || []).map(async (att) => {
      // Use existing URL if it's already saved
      if (att.file_url) {
        return {
          attachment_id: att.attachment_id,
          file_url: att.file_url,
          file_name: att.file_name,
          file_type: att.file_type,
          file_size: att.file_size,
          created_at: att.created_at,
        };
      }
      
      // Create a signed URL if needed
      const { data: urlData } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(att.file_path, 60 * 60 * 24 * 365);
      
      return {
        attachment_id: att.attachment_id,
        file_url: urlData?.signedUrl || null,
        file_name: att.file_name,
        file_type: att.file_type,
        file_size: att.file_size,
        created_at: att.created_at,
      };
    }));

    // Also fetch context pulls for node state update
    const { data: pulledConnections } = await supabase
      .from('context_pulls')
      .select('origin_node_id, last_pulled_at')
      .eq('target_node_id', nodeId);
    
    const pulledConnectionsWithUpdates = await Promise.all(
      (pulledConnections || []).map(async (pull) => {
        const { data: latestMessage } = await supabase
          .from('chat_messages')
          .select('timestamp')
          .eq('node_id', pull.origin_node_id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();
        
        const hasUpdates = latestMessage
          ? new Date(latestMessage.timestamp) > new Date(pull.last_pulled_at)
          : false;
        
        return { nodeId: pull.origin_node_id.toString(), hasUpdates };
      })
    );

    const { data: pulledByConnections } = await supabase
      .from('context_pulls')
      .select('target_node_id')
      .eq('origin_node_id', nodeId);
    
    const pulledByConnectionsData = (pulledByConnections || []).map((pull) => ({
      nodeId: pull.target_node_id.toString(),
    }));

    io.to(nodeRoom).emit('node-state-update', {
      nodeId,
      pulledConnections: pulledConnectionsWithUpdates,
      pulledByConnections: pulledByConnectionsData,
      attachments,
    });

    return res.json({ attachment });
  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to upload file'
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