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

export class ChatService {
  private model: BaseChatModel | null = null;
  private nodeId: number;
  private userId: string;
  private systemPrompt: string | null = null;

  constructor(nodeId: number, userId: string, modelName: string, apiKey: string, flavorName?: string) {
    this.nodeId = nodeId;
    this.userId = userId;

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