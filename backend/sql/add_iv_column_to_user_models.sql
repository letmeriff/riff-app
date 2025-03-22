-- Add 'iv' column to user_models table for storing initialization vector for encryption
ALTER TABLE user_models ADD COLUMN IF NOT EXISTS iv TEXT;

-- Add comment to the column
COMMENT ON COLUMN user_models.iv IS 'Initialization vector for API key encryption'; 