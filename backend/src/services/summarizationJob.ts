import { SummarizationService } from './summarizationService';
import { getUserModels } from './modelService';
import { supabase } from '../config/supabase';

/**
 * Process nodes with pending summaries that were triggered by the Supabase function.
 * This job handles actual summarization of chat histories that exceed the threshold.
 */
export const processPendingSummaries = async (): Promise<void> => {
  try {
    console.log('Running summarization job to process pending summaries...');
    
    // Fetch nodes with pending summaries
    const { data: pendingSummaries, error: summariesError } = await supabase
      .from('chat_summaries')
      .select('node_id')
      .eq('summary', 'Pending summarization...');
    
    if (summariesError) {
      console.error('Error fetching pending summaries:', summariesError);
      return;
    }

    if (!pendingSummaries || pendingSummaries.length === 0) {
      console.log('No pending summaries to process');
      return;
    }
    
    console.log(`Found ${pendingSummaries.length} pending summaries to process`);

    for (const summary of pendingSummaries) {
      const nodeId = summary.node_id;
      console.log(`Processing summary for node ${nodeId}...`);

      // Fetch the node's model and user
      const { data: node, error: nodeError } = await supabase
        .from('chat_nodes')
        .select('user_id, model')
        .eq('node_id', nodeId)
        .single();
      
      if (nodeError || !node) {
        console.error(`Error fetching node ${nodeId}:`, nodeError);
        continue;
      }

      const userId = node.user_id;
      const modelName = node.model;
      
      if (!modelName) {
        console.error(`Node ${nodeId} has no model configured`);
        continue;
      }

      // Fetch the user's model configuration
      const userModels = await getUserModels(userId);
      const modelConfig = userModels.find((m) => m.model_name === modelName);
      
      if (!modelConfig) {
        console.error(`Model ${modelName} not found for user ${userId}`);
        continue;
      }

      // Summarize the chat history
      try {
        const summarizationService = new SummarizationService(modelName, modelConfig.api_key);
        const summaryText = await summarizationService.summarizeChatHistory(nodeId);

        // Update the summary in the chat_summaries table
        const { error: updateError } = await supabase
          .from('chat_summaries')
          .update({ summary: summaryText })
          .eq('node_id', nodeId);
        
        if (updateError) {
          console.error(`Error updating summary for node ${nodeId}:`, updateError);
        } else {
          console.log(`Successfully updated summary for node ${nodeId}`);
        }
      } catch (error) {
        console.error(`Error summarizing chat history for node ${nodeId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing pending summaries:', error);
  }
}; 