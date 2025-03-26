import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useSocket } from '../contexts/SocketContext';
import { useNetwork } from '../contexts/NetworkContext';
import { useAuth } from '../contexts/AuthContext';
import { ChatNode, updateNodeTitle, updateNodeDescription } from '../services/nodeService';
import { Prompt } from '../services/promptService';

interface ChatMessage {
  message_id: number;
  node_id: number;
  content: string;
  is_user: boolean;
  timestamp: string;
}

interface ChatAttachment {
  attachment_id: number;
  node_id: number;
  user_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
  file_url?: string;
}

interface UserPresence {
  userId: string;
  email: string;
  isTyping: boolean;
  lastActive: string;
}

interface ChatUIProps {
  nodeId: string | null; // Selected node's ID
  nodeTitle: string | null; // Selected node's title
  userId: string; // Current user's ID
}

// Define types for mixed items
interface AttachmentItem {
  isAttachment: true;
  attachment: ChatAttachment;
  timestamp: string;
}

type ChatItem = ChatMessage | AttachmentItem;

const ChatUI: React.FC<ChatUIProps> = ({ nodeId, nodeTitle, userId }) => {
  // Add CSS keyframes for animations
  const fadeInKeyframes = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  const { socket } = useSocket();
  const { 
    networkAdapter, 
    connectionStatus: _connectionStatus, 
    sendMessage, 
    subscribeToEvent, 
    updateUserPresence 
  } = useNetwork();
  const { user: _user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<ChatNode[]>([]);
  const [selectedPullNode, setSelectedPullNode] = useState<string>('');
  const [pullLoading, setPullLoading] = useState(false);
  const [pullMode, setPullMode] = useState<'full' | 'summary'>('full');
  const [branchLoading, setBranchLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [presentUsers, setPresentUsers] = useState<UserPresence[]>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [currentNode, setCurrentNode] = useState<ChatNode | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const [_avatarMenuOpen, _setAvatarMenuOpen] = useState<number | null>(null);

  // Fetch available nodes for the Pull dropdown
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_nodes')
          .select('*');
        
        if (error) throw error;
        setNodes(data || []);
      } catch (error) {
        console.error('Error fetching nodes:', error);
      }
    };

    fetchNodes();
  }, []);

  // Add a new useEffect to fetch attachments when nodeId changes
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
          throw new Error('Authentication token not found. Please log in again.');
        }
        
        const response = await fetch(`http://localhost:3001/api/attachments/${nodeId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
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
  }, [nodeId]);

  // Scroll to bottom when messages or attachments change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, attachments]);

  // Fetch messages when the node changes and set up real-time updates
  useEffect(() => {
    if (!nodeId) {
      setMessages([]);
      setTypingUsers([]);
      setIsOwner(false);
      setPresentUsers([]);
      setAttachments([]);
      setCurrentNode(null);
      return;
    }

    const fetchMessages = async () => {
      try {
        console.log(`Fetching messages for node ${nodeId}`);
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('node_id', parseInt(nodeId))
          .order('timestamp', { ascending: true });
        
        if (error) {
          console.error('Error fetching messages:', error);
          throw error;
        }
        console.log(`Fetched ${data?.length || 0} messages for node ${nodeId}`);
        setMessages(data || []);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
    fetchNodeDetails();

    // Set up real-time updates for messages
    if (networkAdapter) {
      // Use NetworkAdapter for real-time updates
      const unsubscribeMessage = subscribeToEvent('message-update', (payload) => {
        console.log('Message update received:', payload);
        console.log('Current nodeId:', nodeId, 'Payload node_id:', payload.new?.node_id);
        if (payload.new && payload.new.node_id === parseInt(nodeId)) {
          setMessages((prev) => {
            // Check if this message is already in the list to avoid duplicates
            if (!payload.new || prev.some((msg) => msg.message_id === payload.new.message_id)) {
              console.log('Message already exists in state, not adding again');
              return prev;
            }
            console.log('Adding new message to state');
            return [...prev, payload.new as ChatMessage];
          });
        } else {
          console.log('Message is for a different node, ignoring');
        }
      });

      const unsubscribePresence = subscribeToEvent('presence-update', (payload) => {
        console.log('Presence update received in ChatUI:', payload);
        if (payload.nodeId.toString() === nodeId) {
          // Extract emails of users who are typing (excluding the current user)
          const typing = payload.presence
            .filter((p: UserPresence) => p.isTyping && p.userId !== userId)
            .map((p: UserPresence) => p.email);
          
          setTypingUsers(typing);
          setPresentUsers(payload.presence);
        }
      });

      // Listen for ownership updates
      const unsubscribeOwnership = subscribeToEvent('ownership-update', (payload) => {
        console.log('Ownership update received:', payload);
        if (payload.nodeId.toString() === nodeId) {
          setIsOwner(payload.ownerId === userId);
          
          // Refresh node details
          fetchNodeDetails();
        }
      });

      const unsubscribeTransferError = subscribeToEvent('transfer-ownership-error', (payload) => {
        if (payload.nodeId.toString() === nodeId) {
          console.error('Ownership transfer error:', payload.error);
          alert(`Failed to transfer ownership: ${payload.error}`);
          setIsTransferring(false);
        }
      });

      // Listen for node updates
      const unsubscribeNodeUpdate = subscribeToEvent('node-update', (payload) => {
        if (payload.new && payload.new.node_id.toString() === nodeId) {
          console.log('Node update detected, refreshing node details');
          fetchNodeDetails();
        }
      });

      // Listen for attachment updates
      const unsubscribeAttachmentUpdate = subscribeToEvent('attachment-update', (payload) => {
        console.log('Attachment update received:', payload);
        if (payload.nodeId.toString() === nodeId) {
          setAttachments((prev) => {
            // Check if this attachment is already in the list to avoid duplicates
            if (prev.some((att) => att.attachment_id === payload.attachment.attachment_id)) {
              // Update the existing attachment
              return prev.map((att) => 
                att.attachment_id === payload.attachment.attachment_id ? payload.attachment : att
              );
            }
            // Add the new attachment
            return [...prev, payload.attachment];
          });
        }
      });

      // Listen for attachment deletions
      const unsubscribeAttachmentDelete = subscribeToEvent('attachment-delete', (payload) => {
        console.log('Attachment delete received:', payload);
        if (payload.nodeId.toString() === nodeId) {
          setAttachments((prev) => 
            prev.filter((att) => att.attachment_id !== payload.attachmentId)
          );
        }
      });

      return () => {
        unsubscribeMessage();
        unsubscribePresence();
        unsubscribeOwnership();
        unsubscribeTransferError();
        unsubscribeNodeUpdate();
        unsubscribeAttachmentUpdate();
        unsubscribeAttachmentDelete();
      };
    } else {
      // Fallback to Supabase real-time if network adapter is not available
      const subscription = supabase
        .channel(`chat_messages:node_${nodeId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `node_id=eq.${nodeId}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as ChatMessage]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [nodeId, networkAdapter, subscribeToEvent, userId]);

  // Update editedTitle and editedDescription when nodeTitle or currentNode changes
  useEffect(() => {
    if (nodeTitle) {
      setEditedTitle(nodeTitle);
    }
  }, [nodeTitle]);
  
  useEffect(() => {
    if (currentNode) {
      setEditedDescription(currentNode.description || 'No description available.');
    }
  }, [currentNode]);

  // Handle input changes and emit typing events
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (!nodeId || !isOwner) return;

    // Update typing status using network adapter
    updateUserPresence(nodeId, true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set a timeout to stop typing indication after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (nodeId) {
        updateUserPresence(nodeId, false);
      }
    }, 2000);
  };

  // Add handlers for drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (!nodeId || !isOwner) return;
    
    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      
      const prompt = JSON.parse(data) as Prompt;
      if (!prompt || !prompt.content) return;
      
      // Create a placeholder message showing which prompt was applied
      const placeholderMessage = `Applied ${prompt.type}: ${prompt.name}\n\n${prompt.content}`;
      
      // Add the placeholder message to the chat
      try {
        // Save the message to the database
        const { data: messageData, error: messageError } = await supabase
          .from('chat_messages')
          .insert({
            node_id: parseInt(nodeId),
            content: placeholderMessage,
            is_user: true,
            timestamp: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (messageError) throw messageError;
        
        // Add the message to the local state
        if (messageData) {
          setMessages(prev => [...prev, messageData]);
        }
        
        // Set the input to the prompt content for the user to customize if needed
        setInput(prompt.content);
        
        // Scroll to the bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        
        // Focus the input field after a short delay
        setTimeout(() => {
          const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
          if (inputElement) {
            inputElement.focus();
          }
        }, 200);
      } catch (error) {
        console.error('Error adding placeholder message:', error);
      }
    } catch (error) {
      console.error('Error parsing dropped prompt:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !nodeId || !socket) return;
    
    // Don't modify the message text with references to attachments
    const messageText = input;
    setInput('');
    
    // Temporarily add the message to the UI for immediate feedback
    const tempMessage: ChatMessage = {
      message_id: Date.now(), // Temporary ID
      node_id: parseInt(nodeId),
      content: messageText,
      is_user: true,
      timestamp: new Date().toISOString(),
    };
    
    setMessages((msgs) => [...msgs, tempMessage]);
    
    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      setLoading(true);
      
      // Only get recent attachments (uploaded in the last minute)
      // which haven't been sent with a message yet
      const recentAttachments = attachments
        .filter(att => {
          const uploadTime = new Date(att.created_at).getTime();
          const now = new Date().getTime();
          const timeDiff = now - uploadTime;
          // Check if it was uploaded in the last minute and is after the last message
          return timeDiff < 60000 && 
            (messages.length === 0 || 
             uploadTime > new Date(messages[messages.length - 1].timestamp).getTime());
        })
        .map(att => ({
          attachment_id: att.attachment_id,
          file_type: att.file_type,
          file_name: att.file_name
        }));
      
      // Send the message with recent attachments to the server
      const response = await fetch(`http://localhost:3001/api/chat/${nodeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          message: messageText,
          attachments: recentAttachments
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }
      
      // Just consume the response body without assigning the unused data variable
      await response.json();
      
      // Server will broadcast the message via socket, so no need to update state here
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message: ' + (error instanceof Error ? error.message : 'Unknown error'));
      
      // Remove the temporary message on error
      setMessages((msgs) => msgs.filter((msg) => msg.message_id !== tempMessage.message_id));
    } finally {
      setLoading(false);
    }
  };

  const handlePullContext = async () => {
    if (!nodeId || !selectedPullNode) return;
    
    setPullLoading(true);
    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      // For summary mode, first get a summary of the selected node
      if (pullMode === 'summary') {
        const summaryResponse = await fetch(
          `http://localhost:3001/api/summarize/${selectedPullNode}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!summaryResponse.ok) {
          const errorData = await summaryResponse.json();
          throw new Error(errorData.error || 'Failed to generate summary');
        }
        
        const { summary } = await summaryResponse.json();
        
        // Add summary message directly
        const { error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            node_id: parseInt(nodeId),
            content: `Summary pulled from Node ${selectedPullNode}:\n\n${summary}`,
            is_user: false,
            timestamp: new Date().toISOString(),
          });
        
        if (insertError) throw insertError;
      }
      
      // Always establish the pull relationship
      const pullResponse = await fetch('http://localhost:3001/api/context/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetNodeId: parseInt(nodeId),
          originNodeId: parseInt(selectedPullNode),
          mode: pullMode
        }),
      });
      
      if (!pullResponse.ok) {
        const errorData = await pullResponse.json();
        throw new Error(errorData.error || 'Failed to pull context');
      }
      
      // Reset the pull node selection
      setSelectedPullNode('');
    } catch (error) {
      console.error('Error pulling context:', error);
      alert(error instanceof Error ? error.message : 'An error occurred while pulling context');
    } finally {
      setPullLoading(false);
    }
  };

  const handleBranch = async () => {
    if (!nodeId) return;
    
    setBranchLoading(true);
    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      const response = await fetch('http://localhost:3001/api/branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ originNodeId: parseInt(nodeId) }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to branch node');
      }
      
      const { newNodeId } = await response.json();
      
      // Dispatch a custom event to notify other components that node selection should change
      window.dispatchEvent(
        new CustomEvent('select-node', { 
          detail: { nodeId: newNodeId.toString() } 
        })
      );
    } catch (error) {
      console.error('Error branching node:', error);
      alert(error instanceof Error ? error.message : 'An error occurred while branching the node');
    } finally {
      setBranchLoading(false);
    }
  };

  const handleTransferOwnership = () => {
    if (!nodeId || !isOwner || !selectedNewOwner || !socket) return;
    
    setIsTransferring(true);
    try {
      socket.emit('transfer-ownership', {
        nodeId: parseInt(nodeId),
        newOwnerId: selectedNewOwner
      });
      
      // Reset the selection
      setSelectedNewOwner('');
    } catch (error) {
      console.error('Error initiating ownership transfer:', error);
      alert(error instanceof Error ? error.message : 'An error occurred while transferring ownership');
      setIsTransferring(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!nodeId || !isOwner || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    
    // Add client-side file size validation
    const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB limit
    if (file.size > MAX_FILE_SIZE) {
      alert(`File size exceeds the maximum allowed size (8MB). Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
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

      // Upload the file to the new endpoint
      const response = await fetch('http://localhost:3001/api/attachments/upload', {
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
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }

      // Just check the response status, no need to extract the attachment since it's handled by socket
      await response.json();
      
      // The server will handle broadcasting the attachment via socket
      // and updating the UI, so we don't need to manually add it to state

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!nodeId) return;

    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      const response = await fetch(`http://localhost:3001/api/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete attachment');
      }
      
      // The socket will handle updating the UI when the server confirms the deletion
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert('Error deleting attachment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleTitleEdit = () => {
    if (isOwner && nodeId) {
      setIsEditingTitle(true);
      // Focus the input after a brief delay to allow rendering
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  };

  const handleTitleSave = async () => {
    if (isOwner && nodeId && editedTitle.trim()) {
      try {
        await updateNodeTitle(parseInt(nodeId), editedTitle.trim());
        setIsEditingTitle(false);
        // The actual UI update will happen through the real-time subscription
      } catch (error) {
        console.error('Error updating node title:', error);
      }
    }
  };

  const handleTitleCancel = () => {
    if (nodeTitle) {
      setEditedTitle(nodeTitle);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const toggleHeaderExpand = () => {
    setIsHeaderExpanded(!isHeaderExpanded);
  };

  const handleDescriptionEdit = () => {
    if (isOwner && nodeId) {
      setIsEditingDescription(true);
      // Focus the textarea after a brief delay to allow rendering
      setTimeout(() => {
        descriptionInputRef.current?.focus();
      }, 50);
    }
  };

  const handleDescriptionSave = async () => {
    if (isOwner && nodeId && editedDescription.trim()) {
      try {
        await updateNodeDescription(parseInt(nodeId), editedDescription.trim());
        setIsEditingDescription(false);
        // The actual UI update will happen through the real-time subscription
      } catch (error) {
        console.error('Error updating node description:', error);
      }
    }
  };

  const handleDescriptionCancel = () => {
    if (currentNode && currentNode.description) {
      setEditedDescription(currentNode.description);
    } else {
      setEditedDescription('No description available.');
    }
    setIsEditingDescription(false);
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleDescriptionCancel();
    }
  };

  // Sort and combine messages and attachments
  const combinedItems: ChatItem[] = [
    ...messages.map(msg => msg as ChatMessage),
    ...attachments.map(attachment => ({
      isAttachment: true,
      attachment,
      timestamp: attachment.created_at
    } as AttachmentItem))
  ].sort((a, b) => {
    const timeA = 'isAttachment' in a ? new Date(a.timestamp).getTime() : new Date(a.timestamp).getTime();
    const timeB = 'isAttachment' in b ? new Date(b.timestamp).getTime() : new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

  // Function to fetch node details
  const fetchNodeDetails = async () => {
    if (!nodeId) return;
    
    try {
      console.log(`Fetching node details for node ${nodeId}`);
      const { data, error } = await supabase
        .from('chat_nodes')
        .select('*')
        .eq('node_id', parseInt(nodeId))
        .single();
      
      if (error) {
        console.error('Error fetching node details:', error);
        throw error;
      }
      
      setCurrentNode(data);
      const isOwnerValue = data.owner_id === userId;
      console.log(`User ${userId} is ${isOwnerValue ? '' : 'not '}the owner of node ${nodeId}`);
      setIsOwner(isOwnerValue);
    } catch (error) {
      console.error('Error fetching node details:', error);
    }
  };

  // Join node room when component mounts
  useEffect(() => {
    if (!nodeId) return;
    
    // Use network adapter to join node
    if (networkAdapter) {
      sendMessage('join-node', { nodeId });
    } else if (socket) {
      // Fallback to direct socket usage
      socket.emit('join-node', { nodeId });
    }
    
    // Clean up when component unmounts
    return () => {
      if (networkAdapter) {
        sendMessage('leave-node', { nodeId });
      } else if (socket) {
        socket.emit('leave-node', { nodeId });
      }
    };
  }, [nodeId, networkAdapter, socket, sendMessage]);

  return (
    <div 
      className="chat-container" 
      style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        border: isDragOver ? '2px dashed #3182CE' : '1px solid #ddd',
        background: isDragOver ? 'rgba(235, 248, 255, 0.6)' : 'white',
        transition: 'all 0.2s'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={nodeId && isOwner ? handleDrop : undefined}
    >
      <style>{fadeInKeyframes}</style>
      <div
        style={{
          padding: '10px',
          background: '#fff',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
          boxShadow: isHeaderExpanded ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none',
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <div style={{ flex: 1 }}>
            {nodeId && isOwner && isEditingTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  style={{ 
                    fontWeight: 'bold', 
                    fontSize: '18px',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    border: '1px solid #aaa',
                    width: '100%'
                  }}
                />
                <button
                  onClick={handleTitleSave}
                  style={{
                    padding: '3px 8px',
                    background: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={handleTitleCancel}
                  style={{
                    padding: '3px 8px',
                    background: '#ddd',
                    color: '#333',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div 
                style={{ 
                  fontWeight: 'bold', 
                  fontSize: '18px',
                  cursor: isOwner && nodeId ? 'pointer' : 'default'
                }}
                onClick={handleTitleEdit}
                title={isOwner && nodeId ? "Click to edit title" : ""}
              >
                {nodeTitle || 'No node selected'}
                {isOwner && nodeId && (
                  <span style={{ marginLeft: '5px', fontSize: '14px', color: '#666' }}>
                    ✏️
                  </span>
                )}
              </div>
            )}
            {nodeId && (
              <div style={{ fontSize: '12px', color: '#777' }}>
                ID: {nodeId} | {isOwner ? 'You are the owner' : 'You are viewing (read-only)'}
              </div>
            )}
          </div>
          
          {nodeId && (
            <button
              onClick={toggleHeaderExpand}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                transition: 'background 0.2s',
                transform: isHeaderExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                marginLeft: '10px'
              }}
              title={isHeaderExpanded ? "Collapse details" : "Expand details"}
            >
              ▼
            </button>
          )}
        </div>
        
        {isHeaderExpanded && currentNode && (
          <div 
            style={{ 
              marginTop: '10px',
              padding: '10px',
              background: '#f8f9fa',
              borderRadius: '6px',
              fontSize: '14px',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '6px 12px',
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#555' }}>Description:</div>
            <div>
              {isEditingDescription ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <textarea
                    ref={descriptionInputRef}
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    onKeyDown={handleDescriptionKeyDown}
                    style={{ 
                      padding: '6px',
                      borderRadius: '4px',
                      border: '1px solid #aaa',
                      minHeight: '80px',
                      width: '100%',
                      fontSize: '14px',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleDescriptionSave}
                      style={{
                        padding: '3px 8px',
                        background: '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleDescriptionCancel}
                      style={{
                        padding: '3px 8px',
                        background: '#ddd',
                        color: '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  style={{ 
                    cursor: isOwner ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onClick={isOwner ? handleDescriptionEdit : undefined}
                  title={isOwner ? "Click to edit description" : ""}
                >
                  <div style={{ flex: 1 }}>
                    {currentNode.description || 'No description available.'}
                  </div>
                  {isOwner && (
                    <span style={{ fontSize: '14px', color: '#666', marginLeft: '5px' }}>
                      ✏️
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div style={{ fontWeight: 'bold', color: '#555' }}>Created:</div>
            <div>{new Date(currentNode.created_at).toLocaleString()}</div>
            
            <div style={{ fontWeight: 'bold', color: '#555' }}>Model:</div>
            <div>{currentNode.model || 'Not specified'}</div>
            
            <div style={{ fontWeight: 'bold', color: '#555' }}>Flavor:</div>
            <div>{currentNode.flavor || 'Not specified'}</div>
            
            <div style={{ fontWeight: 'bold', color: '#555' }}>Created by:</div>
            <div>{currentNode.user_id}</div>
            
            <div style={{ fontWeight: 'bold', color: '#555' }}>Owner:</div>
            <div>{currentNode.owner_id}</div>
            
            <div style={{ fontWeight: 'bold', color: '#555' }}>Position:</div>
            <div>X: {currentNode.position_x?.toFixed(2) || '0'}, Y: {currentNode.position_y?.toFixed(2) || '0'}</div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '20px',
          flexGrow: 1,
          overflowY: 'auto',
          background: '#f5f5f5',
          maxHeight: isHeaderExpanded ? 'calc(100% - 180px)' : 'calc(100% - 60px)',
          transition: 'max-height 0.3s ease',
        }}
      >
        {/* Combine messages and attachments in a single chronological list */}
        {combinedItems.map((item) => {
          if ('isAttachment' in item) {
            const attachment = item.attachment;
            return (
              <div
                key={`attachment-${attachment.attachment_id}`}
                style={{
                  alignSelf: 'flex-start',
                  background: '#e0e0e0',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  maxWidth: '70%',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <a 
                    href={attachment.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#0066cc', textDecoration: 'none' }}
                  >
                    {attachment.file_name} ({(attachment.file_size / 1024).toFixed(2)} KB)
                  </a>
                  {(isOwner || attachment.user_id === userId) && (
                    <button
                      onClick={() => handleDeleteAttachment(attachment.attachment_id)}
                      style={{
                        marginLeft: '8px',
                        background: 'none',
                        border: 'none',
                        color: '#ff4444',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>
                  {new Date(attachment.created_at).toLocaleTimeString()}
                </div>
                {attachment.file_type.startsWith('image/') && (
                  <img 
                    src={attachment.file_url} 
                    alt={attachment.file_name}
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '300px', 
                      borderRadius: '5px',
                      marginTop: '5px'
                    }}
                  />
                )}
              </div>
            );
          } else {
            const msg = item;
            return (
              <div
                key={`message-${msg.message_id}`}
                style={{
                  alignSelf: msg.is_user ? 'flex-end' : 'flex-start',
                  background: msg.is_user ? '#007bff' : '#fff',
                  color: msg.is_user ? '#fff' : '#000',
                  padding: '10px 15px',
                  borderRadius: '18px',
                  maxWidth: '70%',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                  position: 'relative',
                }}
              >
                <div>{msg.content}</div>
                <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '5px' }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            );
          }
        })}

        {loading && (
          <div style={{ alignSelf: 'flex-start', color: '#777' }}>
            AI is typing...
          </div>
        )}

        {isUploading && (
          <div style={{ alignSelf: 'flex-start', color: '#777' }}>
            Uploading file...
          </div>
        )}

        {typingUsers.length > 0 && (
          <div style={{ alignSelf: 'flex-start', color: '#777' }}>
            {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: '10px',
          background: '#fff',
          borderTop: '1px solid #ddd',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '5px 10px',
              background: nodeId && isOwner && !isUploading ? '#007bff' : '#ddd',
              color: nodeId && isOwner && !isUploading ? '#fff' : '#000',
              border: 'none',
              borderRadius: '5px',
              cursor: nodeId && isOwner && !isUploading ? 'pointer' : 'not-allowed',
            }}
            disabled={!nodeId || !isOwner || isUploading}
            type="button"
          >
            {isUploading ? 'Uploading...' : 'Attach'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            disabled={!nodeId || !isOwner || isUploading}
          />
          
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <select
              value={selectedPullNode}
              onChange={(e) => setSelectedPullNode(e.target.value)}
              style={{ padding: '5px' }}
              disabled={!nodeId || pullLoading}
            >
              <option value="">Select a node to pull from</option>
              {nodes
                .filter((node) => node.node_id.toString() !== nodeId)
                .map((node) => (
                  <option key={node.node_id} value={node.node_id}>
                    {node.title} (ID: {node.node_id})
                  </option>
                ))}
            </select>
            <select
              value={pullMode}
              onChange={(e) => setPullMode(e.target.value as 'full' | 'summary')}
              style={{ padding: '5px' }}
              disabled={!nodeId || pullLoading || !selectedPullNode}
            >
              <option value="full">Full History</option>
              <option value="summary">Summary</option>
            </select>
            <button
              onClick={handlePullContext}
              style={{
                padding: '5px 10px',
                background: selectedPullNode && !pullLoading ? '#007bff' : '#ddd',
                color: selectedPullNode && !pullLoading ? '#fff' : '#000',
                border: 'none',
                borderRadius: '5px',
                cursor: selectedPullNode && !pullLoading ? 'pointer' : 'not-allowed',
              }}
              disabled={!selectedPullNode || pullLoading}
              type="button"
            >
              {pullLoading ? 'Pulling...' : 'Pull'}
            </button>
          </div>
          
          <button
            onClick={handleBranch}
            style={{
              padding: '5px 10px',
              background: nodeId && !branchLoading ? '#007bff' : '#ddd',
              color: nodeId && !branchLoading ? '#fff' : '#000',
              border: 'none',
              borderRadius: '5px',
              cursor: nodeId && !branchLoading ? 'pointer' : 'not-allowed',
            }}
            disabled={!nodeId || branchLoading}
            type="button"
          >
            {branchLoading ? 'Branching...' : 'Branch'}
          </button>
          
          {isOwner && presentUsers.length > 1 && (
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <select
                value={selectedNewOwner}
                onChange={(e) => setSelectedNewOwner(e.target.value)}
                style={{ padding: '5px' }}
                disabled={isTransferring}
              >
                <option value="">Transfer ownership to...</option>
                {presentUsers
                  .filter((user) => user.userId !== userId)
                  .map((user) => (
                    <option key={user.userId} value={user.userId}>
                      {user.email}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleTransferOwnership}
                style={{
                  padding: '5px 10px',
                  background: selectedNewOwner && !isTransferring ? '#007bff' : '#ddd',
                  color: selectedNewOwner && !isTransferring ? '#fff' : '#000',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: selectedNewOwner && !isTransferring ? 'pointer' : 'not-allowed',
                }}
                disabled={!selectedNewOwner || isTransferring}
                type="button"
              >
                {isTransferring ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          )}
        </div>
        
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{ display: 'flex', gap: '10px' }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleInputChange(e);
            }}
            disabled={!nodeId || !isOwner}
            placeholder={
              nodeId 
                ? isOwner 
                  ? 'Type a message...' 
                  : 'Only the node owner can write messages'
                : 'Select a node to start chatting'
            }
            style={{
              padding: '10px',
              borderRadius: '20px',
              border: '1px solid #ddd',
              flexGrow: 1,
            }}
          />
          <button
            type="submit"
            disabled={!nodeId || loading || !input.trim() || !isOwner}
            style={{
              padding: '10px 15px',
              background: !nodeId || loading || !input.trim() || !isOwner ? '#ddd' : '#007bff',
              color: !nodeId || loading || !input.trim() || !isOwner ? '#666' : '#fff',
              border: 'none',
              borderRadius: '20px',
              cursor: !nodeId || loading || !input.trim() || !isOwner ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatUI; 