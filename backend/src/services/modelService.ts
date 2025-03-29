import { supabase } from '../config/supabase';
import { encrypt, decrypt } from '../utils/encryption';

export interface UserModel {
  id: number;
  user_id: string;
  model_name: string;
  api_key: string;
  iv?: string; // Initialization vector for decryption
  created_at: string;
}

export const getUserModels = async (userId: string): Promise<UserModel[]> => {
  const { data, error } = await supabase
    .from('user_models')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;

  // Decrypt API keys before returning
  return data.map((model) => ({
    ...model,
    api_key: model.iv ? decrypt(model.iv, model.api_key) : model.api_key,
  }));
};

export const addUserModel = async (
  userId: string,
  modelName: string,
  apiKey: string
): Promise<UserModel> => {
  // Encrypt the API key
  const { iv, encrypted } = encrypt(apiKey);

  const { data, error } = await supabase
    .from('user_models')
    .insert({ user_id: userId, model_name: modelName, api_key: encrypted, iv })
    .select()
    .single();
  if (error) throw error;

  // Return the model with the decrypted key
  return { ...data, api_key: apiKey };
};

export const deleteUserModel = async (modelId: number): Promise<void> => {
  const { error } = await supabase.from('user_models').delete().eq('id', modelId);
  if (error) throw error;
}; 