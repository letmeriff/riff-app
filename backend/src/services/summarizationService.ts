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

export class SummarizationService {
  private model: BaseChatModel;

  constructor(modelName: string, apiKey: string) {
    if (modelName.startsWith('openai/')) {
      this.model = new ChatOpenAI({
        model: modelName.split('/')[1],
        apiKey: apiKey,
        temperature: 0.3, // Lower temperature for more factual summaries
      });
    } else if (modelName.startsWith('anthropic/')) {
      this.model = new ChatAnthropic({
        model: modelName.split('/')[1],
        apiKey: apiKey,
        temperature: 0.3,
      });
    } else {
      throw new Error(`Unsupported model: ${modelName}`);
    }
  }

  public async summarizeChatHistory(nodeId: number): Promise<string> {
    // Fetch the chat history
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('node_id', nodeId)
      .order('timestamp', { ascending: true });
    if (messagesError) throw messagesError;

    if (!messages || !messages.length) return 'No messages to summarize.';

    // Format the chat history as a string
    const chatHistory = messages
      .map((msg) => `${msg.is_user ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n');

    // Use LangChain to summarize the chat history
    const prompt = new SystemMessage(
      'You are an AI assistant tasked with summarizing a chat conversation. Provide a concise summary of the conversation in 2-3 sentences.'
    );
    const message = new HumanMessage(`Summarize the following chat history:\n${chatHistory}`);

    const response = await this.model.invoke([prompt, message]);
    const summary = response.content as string;

    // Save the summary to the chat_summaries table
    const { error: insertError } = await supabase
      .from('chat_summaries')
      .upsert({ node_id: nodeId, summary })
      .select();
    if (insertError) throw insertError;

    return summary;
  }
} 