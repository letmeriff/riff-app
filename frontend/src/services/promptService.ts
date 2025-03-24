import api from '../utils/api';

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