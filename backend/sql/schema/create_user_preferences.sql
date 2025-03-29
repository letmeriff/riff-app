-- Create the user_preferences table to store user starred prompts
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)
);

-- Set up Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policy for users to select only their own preferences
CREATE POLICY select_own_preferences ON user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own preferences
CREATE POLICY insert_own_preferences ON user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own preferences
CREATE POLICY update_own_preferences ON user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy for users to delete their own preferences
CREATE POLICY delete_own_preferences ON user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_prompt_id ON user_preferences(prompt_id);
CREATE INDEX idx_user_preferences_is_starred ON user_preferences(is_starred); 