import { supabase } from '../config/supabase';

export interface Flavor {
  id: number;
  name: string;
  system_prompt: string;
  created_at: string;
}

export const getFlavors = async (): Promise<Flavor[]> => {
  const { data, error } = await supabase.from('flavors').select('*');
  if (error) throw error;
  return data;
}; 