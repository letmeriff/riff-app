import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useNetwork } from '../contexts/NetworkContext';
import {
  useAttachmentUpdateEvent,
  useAttachmentDeleteEvent,
} from '../contexts/NetworkContext';
import {
  AttachmentUpdatePayload,
  AttachmentDeletePayload,
  ChatAttachment,
} from '../types/messaging';
import {
  parseNodeId,
  compareNodeIds,
  isAttachmentUpdatePayload,
  isAttachmentDeletePayload,
} from '../utils/typeGuards';
import { validatePayload } from '../services/networkService';

export const useChatAttachments = (nodeId: string | null, _userId: string) => {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { networkAdapter } = useNetwork();

  const parsedNodeId = parseNodeId(nodeId);

  // Attachment update handler
  const handleAttachmentUpdate = useCallback(
    (payload: AttachmentUpdatePayload) => {
      console.log('Attachment update received:', payload);

      if (parsedNodeId && compareNodeIds(payload.nodeId, nodeId)) {
        setAttachments((prev) => {
          // Check if this attachment is already in the list to avoid duplicates
          if (
            prev.some(
              (att) => att.attachment_id === payload.attachment.attachment_id
            )
          ) {
            // Update the existing attachment
            return prev.map((att) =>
              att.attachment_id === payload.attachment.attachment_id
                ? payload.attachment
                : att
            );
          }
          // Add the new attachment
          return [...prev, payload.attachment];
        });
      }
    },
    [nodeId, parsedNodeId]
  );

  // Attachment delete handler
  const handleAttachmentDelete = useCallback(
    (payload: AttachmentDeletePayload) => {
      console.log('Attachment delete received:', payload);

      if (parsedNodeId && compareNodeIds(payload.nodeId, nodeId)) {
        setAttachments((prev) =>
          prev.filter((att) => att.attachment_id !== payload.attachmentId)
        );
      }
    },
    [nodeId, parsedNodeId]
  );

  // Register event subscriptions
  const _subscribeToAttachmentUpdates = useAttachmentUpdateEvent(
    handleAttachmentUpdate
  );
  const _subscribeToAttachmentDeletes = useAttachmentDeleteEvent(
    handleAttachmentDelete
  );

  // Fetch attachments when nodeId changes
  useEffect(() => {
    if (!nodeId) {
      setAttachments([]);
      return;
    }

    const fetchAttachments = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          throw new Error(
            'Authentication token not found. Please log in again.'
          );
        }

        const response = await fetch(
          `http://localhost:3001/api/attachments/${nodeId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch attachments');
        }

        const attachmentsData = await response.json();
        setAttachments(attachmentsData);
      } catch (error) {
        console.error('Error fetching attachments:', error);
      }
    };

    fetchAttachments();

    // Set up real-time updates for attachments
    if (networkAdapter) {
      const unsubscribeAttachmentUpdate = networkAdapter.subscribeToEvent(
        'attachment-update',
        (payload) => {
          const validPayload = validatePayload(
            payload,
            isAttachmentUpdatePayload
          );
          if (validPayload) {
            handleAttachmentUpdate(validPayload);
          }
        }
      );

      const unsubscribeAttachmentDelete = networkAdapter.subscribeToEvent(
        'attachment-delete',
        (payload) => {
          const validPayload = validatePayload(
            payload,
            isAttachmentDeletePayload
          );
          if (validPayload) {
            handleAttachmentDelete(validPayload);
          }
        }
      );

      return () => {
        unsubscribeAttachmentUpdate();
        unsubscribeAttachmentDelete();
      };
    }
  }, [nodeId, networkAdapter, handleAttachmentUpdate, handleAttachmentDelete]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!nodeId || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    // Add client-side file size validation
    const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB limit
    if (file.size > MAX_FILE_SIZE) {
      alert(
        `File size exceeds the maximum allowed size (8MB). Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);

    try {
      // Read the file as base64
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1]; // Remove the data URL prefix
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Upload the file to the server
      const response = await fetch(
        'http://localhost:3001/api/attachments/upload',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            nodeId: parseInt(nodeId),
            fileData: base64String,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }

      // Just check the response status, no need to extract the attachment since it's handled by socket
      await response.json();

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(
        'Error uploading file: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number | string) => {
    if (!nodeId) return;

    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Convert string ID to number if needed
      const numericAttachmentId =
        typeof attachmentId === 'string'
          ? parseInt(attachmentId, 10)
          : attachmentId;

      const response = await fetch(
        `http://localhost:3001/api/attachments/${numericAttachmentId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete attachment');
      }

      // The socket will handle updating the UI when the server confirms the deletion
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert(
        'Error deleting attachment: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  };

  // Helper function to format file sizes
  const formatFileSize = (
    fileSizeBytes: number | string | undefined
  ): string => {
    if (fileSizeBytes === undefined) return 'Unknown size';

    // Convert string to number if needed
    const bytes =
      typeof fileSizeBytes === 'string'
        ? parseInt(fileSizeBytes, 10)
        : fileSizeBytes;

    // Handle cases where conversion fails
    if (isNaN(bytes)) return 'Unknown size';

    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return {
    attachments,
    isUploading,
    fileInputRef,
    handleFileUpload,
    handleDeleteAttachment,
    formatFileSize,
  };
};
