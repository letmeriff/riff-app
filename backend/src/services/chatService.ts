import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { supabase } from '../config/supabase';

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
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  extracted_content: string | null;
  created_at: string;
  file_url?: string;
}

export class ChatService {
  private model: BaseChatModel | null = null;
  private nodeId: number;
  private userId: string;
  private systemPrompt: string | null = null;
  private modelName: string;
  private messageAttachments: { attachment_id: number; file_type: string; file_name: string }[] | null = null;

  constructor(
    nodeId: number, 
    userId: string, 
    modelName: string, 
    apiKey: string, 
    flavorName?: string,
    messageAttachments?: { attachment_id: number; file_type: string; file_name: string }[]
  ) {
    this.nodeId = nodeId;
    this.userId = userId;
    this.modelName = modelName;
    this.messageAttachments = messageAttachments || null;

    // Initialize the model based on the model name
    if (modelName.startsWith('openai/')) {
      this.model = new ChatOpenAI({
        model: modelName.split('/')[1], // e.g., "gpt-4"
        apiKey: apiKey,
        temperature: 0.7,
      });
    } else if (modelName.startsWith('anthropic/')) {
      this.model = new ChatAnthropic({
        model: modelName.split('/')[1], // e.g., "claude-3"
        apiKey: apiKey,
        temperature: 0.7,
      });
    } else {
      throw new Error(`Unsupported model: ${modelName}`);
    }

    // If a flavor is provided, fetch and set its system prompt
    if (flavorName) {
      this.fetchFlavorSystemPrompt(flavorName);
    }
  }

  // Fetch the flavor's system prompt
  private async fetchFlavorSystemPrompt(flavorName: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('flavors')
        .select('system_prompt')
        .eq('name', flavorName)
        .single();
      
      if (error) {
        console.error('Error fetching flavor system prompt:', error);
        return;
      }
      
      this.systemPrompt = data?.system_prompt || null;
    } catch (error) {
      console.error('Error in fetchFlavorSystemPrompt:', error);
    }
  }

  // Load attached files content for the node
  private async loadAttachments(): Promise<(SystemMessage | HumanMessage)[]> {
    try {
      let attachmentsToProcess = [];
      
      // If we have specific message attachments, prioritize those
      if (this.messageAttachments && this.messageAttachments.length > 0) {
        // Fetch full details for the specific message attachments
        const { data: specificAttachments, error: specificError } = await supabase
          .from('chat_attachments')
          .select('*')
          .in('attachment_id', this.messageAttachments.map(att => att.attachment_id));
          
        if (specificError) {
          console.error('Error fetching specific attachments:', specificError);
        } else if (specificAttachments && specificAttachments.length > 0) {
          attachmentsToProcess = specificAttachments;
        }
      } else {
        // Otherwise, fetch all attachments for the node
        const { data: allAttachments, error } = await supabase
          .from('chat_attachments')
          .select('*')
          .eq('node_id', this.nodeId)
          .order('created_at', { ascending: true });
        
        if (error) {
          console.error('Error fetching attachments:', error);
          return [];
        }
        
        if (!allAttachments || allAttachments.length === 0) {
          return [];
        }
        
        attachmentsToProcess = allAttachments;
      }
      
      if (attachmentsToProcess.length === 0) {
        return [];
      }
      
      const attachmentMessages: (SystemMessage | HumanMessage)[] = [];
      
      for (const attachment of attachmentsToProcess) {
        if (attachment.file_type === 'application/pdf' && attachment.extracted_content) {
          // For PDF with extracted content, include the text in a SystemMessage
          attachmentMessages.push(
            new SystemMessage({ 
              content: `Attached PDF (${attachment.file_name}):\n${attachment.extracted_content}`
            })
          );
        } else if (attachment.file_type.startsWith('image/')) {
          // For images, if the model is vision-capable, include the image URL
          const isVisionCapable = this.modelName.includes('gpt-4-vision') || 
                                 this.modelName.includes('gpt-4o') ||
                                 this.modelName.includes('claude-3');
          
          if (isVisionCapable) {
            // Create a signed URL for the image
            const { data: urlData } = await supabase.storage
              .from('chat-attachments')
              .createSignedUrl(attachment.file_path, 60 * 60 * 24); // 1 day expiry for security
            
            const fileUrl = urlData?.signedUrl || attachment.file_url;
            
            if (fileUrl) {
              // For OpenAI vision models
              if (this.modelName.startsWith('openai/')) {
                attachmentMessages.push(
                  new HumanMessage({
                    content: [
                      { type: 'text', text: `Attached image (${attachment.file_name}):` },
                      { type: 'image_url', image_url: { url: fileUrl } }
                    ],
                  })
                );
              } else {
                // For Anthropic Claude-3 models
                attachmentMessages.push(
                  new HumanMessage({
                    content: `Attached image (${attachment.file_name}):\n<img src="${fileUrl}" alt="${attachment.file_name}" />`
                  })
                );
              }
            }
          } else {
            // For non-vision models, include a placeholder message
            attachmentMessages.push(
              new SystemMessage({
                content: `Attached image (${attachment.file_name}): [Image content not accessible to this model type]`
              })
            );
          }
        } else {
          // For other file types, include information about the attachment
          attachmentMessages.push(
            new SystemMessage({
              content: `Attached file (${attachment.file_name}, type: ${attachment.file_type}, size: ${(attachment.file_size / 1024).toFixed(2)} KB)`
            })
          );
        }
      }
      
      return attachmentMessages;
    } catch (error) {
      console.error('Error loading attachments:', error);
      return [];
    }
  }

  // Load pulled context from other nodes
  private async loadPulledContext(): Promise<string | null> {
    try {
      // Fetch all context pulls for this node
      const { data: contextPulls, error: pullError } = await supabase
        .from('context_pulls')
        .select('*')
        .eq('target_node_id', this.nodeId);
      
      if (pullError) {
        console.error('Error fetching context pulls:', pullError);
        return null;
      }
      
      if (!contextPulls || contextPulls.length === 0) {
        return null;
      }
      
      // For each origin node, fetch messages
      let allPulledContext = '';
      
      for (const pull of contextPulls) {
        const { data: messages, error: msgError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('node_id', pull.origin_node_id)
          .order('timestamp', { ascending: true });
        
        if (msgError) {
          console.error(`Error fetching messages from node ${pull.origin_node_id}:`, msgError);
          continue;
        }
        
        if (messages && messages.length > 0) {
          const nodeContext = messages
            .map((msg) => `${msg.is_user ? 'User' : 'AI'}: ${msg.content}`)
            .join('\n');
          
          allPulledContext += `\n\n--- Context from Node ${pull.origin_node_id} ---\n${nodeContext}`;
        }
      }
      
      return allPulledContext.trim() || null;
    } catch (error) {
      console.error('Error loading pulled context:', error);
      return null;
    }
  }

  // Load chat history for the node
  private async loadChatHistory(): Promise<(HumanMessage | AIMessage | SystemMessage)[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('node_id', this.nodeId)
      .order('timestamp', { ascending: true });
    if (error) throw error;

    // Start with system message if available
    const messages: (HumanMessage | AIMessage | SystemMessage)[] = [];
    
    // Add system prompt if available
    if (this.systemPrompt) {
      messages.push(new SystemMessage({ content: this.systemPrompt }));
    }
    
    // Add pulled context as a system message
    const pulledContext = await this.loadPulledContext();
    if (pulledContext) {
      messages.push(new SystemMessage({ 
        content: `This node has pulled context from other nodes. Use this as reference when appropriate:\n${pulledContext}`
      }));
    }

    // Add file attachments
    const attachmentMessages = await this.loadAttachments();
    messages.push(...attachmentMessages);

    // Add the conversation history
    messages.push(
      ...data.map((msg: ChatMessage) =>
        msg.is_user
          ? new HumanMessage({ content: msg.content })
          : new AIMessage({ content: msg.content })
      )
    );

    return messages;
  }

  // Save a message to the database
  private async saveMessage(content: string, isUser: boolean): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        node_id: this.nodeId,
        content,
        is_user: isUser,
        timestamp: new Date().toISOString(),
      });
    if (error) throw error;
  }

  // Process a user message and get an AI response
  public async processMessage(userMessage: string): Promise<string> {
    if (!this.model) throw new Error('Model not initialized');

    // Save the user message
    await this.saveMessage(userMessage, true);

    // Load the chat history (including system prompt if available)
    const history = await this.loadChatHistory();

    // Add the new user message to the history if not already included
    // (it should be included from loadChatHistory, but adding this check for robustness)
    const lastMessage = history[history.length - 1];
    if (!(lastMessage instanceof HumanMessage && lastMessage.content === userMessage)) {
      history.push(new HumanMessage({ content: userMessage }));
    }

    // Get the AI response
    const response = await this.model.invoke(history);
    const aiMessage = response.content as string;

    // Save the AI response
    await this.saveMessage(aiMessage, false);

    return aiMessage;
  }
}

/**
 * Generate an AI response based on chat history
 * Simplified function that simulates AI processing for this demo
 */
export const generateAIResponse = async (
  userMessage: string,
  chatHistory: Array<{ content: string; is_user: boolean }>,
  modelName: string,
  flavorName?: string
): Promise<string> => {
  try {
    // In a real implementation, this would use the ChatService class above
    // For this demo, we'll just simulate a response
    
    // Simple response simulation
    const responses = [
      `I understand what you're saying about "${userMessage.substring(0, 30)}...". Let me respond thoughtfully.`,
      `That's an interesting point about "${userMessage.substring(0, 20)}...". Here's what I think...`,
      `Thanks for sharing that. I'd like to add that ${modelName} models are particularly good at this kind of task.`,
      `I'm processing your request using the ${flavorName || 'default'} approach. Here's what I found...`,
      `Based on our conversation history, I'd respond that this relates to previous topics we've discussed.`
    ];
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return a random response
    return responses[Math.floor(Math.random() * responses.length)];
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'I apologize, but I encountered an error processing your request.';
  }
}; 