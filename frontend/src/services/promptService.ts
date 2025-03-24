import api from '../utils/api';
import { supabase } from './supabase';

export enum PromptType {
  FRAMEWORK = 'framework',
  TEMPLATE = 'template'
}

export interface Prompt {
  id: number;
  name: string;
  description: string;
  type: PromptType;
  content: string;
  system_prompt?: string;
  is_starred?: boolean;
  created_at: string;
}

export async function fetchPrompts(): Promise<Prompt[]> {
  try {
    const response = await api.get('/prompts');
    return response.data.prompts;
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return [];
  }
}

export async function fetchPromptsByType(type: PromptType): Promise<Prompt[]> {
  try {
    console.log(`Fetching prompts of type: ${type} from ${api.defaults.baseURL}/prompts?type=${type}`);
    const response = await api.get(`/prompts?type=${type}`);
    console.log(`Response from ${type} prompts:`, response.data);
    return response.data.prompts;
  } catch (error) {
    console.error(`Error fetching ${type} prompts:`, error);
    return [];
  }
}

export async function fetchFrameworks(): Promise<Prompt[]> {
  return fetchPromptsByType(PromptType.FRAMEWORK);
}

export async function fetchTemplates(): Promise<Prompt[]> {
  return fetchPromptsByType(PromptType.TEMPLATE);
}

export async function fetchPromptsWithStarred(userId: string): Promise<{ starred: Prompt[]; all: Prompt[] }> {
  try {
    // Fetch all prompts
    const promptsResponse = await api.get('/prompts');
    const prompts = promptsResponse.data.prompts as Prompt[];
    
    // Fetch user preferences
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('prompt_id, is_starred')
      .eq('user_id', userId);
    
    if (preferencesError) {
      console.error('Error fetching preferences:', preferencesError);
      return { starred: [], all: prompts };
    }
    
    // Create a map of prompt_id to is_starred
    const starredMap = new Map<number, boolean>();
    preferences?.forEach(pref => {
      starredMap.set(pref.prompt_id, pref.is_starred);
    });
    
    // Enhance prompts with is_starred flag
    const enrichedPrompts = prompts.map(prompt => ({
      ...prompt,
      is_starred: starredMap.get(prompt.id) || false
    }));
    
    // Filter out starred prompts
    const starredPrompts = enrichedPrompts.filter(prompt => prompt.is_starred);
    
    return {
      starred: starredPrompts,
      all: enrichedPrompts
    };
  } catch (error) {
    console.error('Error fetching prompts with starred:', error);
    return { starred: [], all: [] };
  }
}

export async function toggleStarPrompt(userId: string, promptId: number, isStarred: boolean): Promise<void> {
  try {
    if (isStarred) {
      // Star the prompt
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ 
          user_id: userId, 
          prompt_id: promptId, 
          is_starred: true 
        }, { 
          onConflict: 'user_id,prompt_id' 
        });
      
      if (error) throw error;
    } else {
      // Unstar the prompt or remove the preference
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ 
          user_id: userId, 
          prompt_id: promptId, 
          is_starred: false 
        }, { 
          onConflict: 'user_id,prompt_id' 
        });
      
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error toggling star prompt:', error);
    throw error;
  }
}

export async function updatePrompt(promptId: number, updates: Partial<Prompt>): Promise<void> {
  try {
    const { error } = await supabase
      .from('prompts')
      .update({
        name: updates.name,
        description: updates.description,
        prompt: updates.content, // Map content back to prompt field in database
      })
      .eq('id', promptId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating prompt:', error);
    throw error;
  }
} 