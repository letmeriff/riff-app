import { supabase } from './supabase';

export interface Framework {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
  created_at: string;
}

export const fetchFrameworks = async (): Promise<Framework[]> => {
  const { data, error } = await supabase
    .from('frameworks')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}; 