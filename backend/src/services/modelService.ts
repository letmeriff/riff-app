import { supabase } from '../config/supabase';

export interface UserModel {
  id: number;
  user_id: string;
  model_name: string;
  api_key: string;
  created_at: string;
}

export const getUserModels = async (userId: string): Promise<UserModel[]> => {
  const { data, error } = await supabase
    .from('user_models')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data;
};

export const addUserModel = async (
  userId: string,
  modelName: string,
  apiKey: string
): Promise<UserModel> => {
  const { data, error } = await supabase
    .from('user_models')
    .insert({ user_id: userId, model_name: modelName, api_key: apiKey })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteUserModel = async (modelId: number): Promise<void> => {
  const { error } = await supabase.from('user_models').delete().eq('id', modelId);
  if (error) throw error;
}; 