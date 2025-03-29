-- Create the frameworks table to store conversation frameworks
CREATE TABLE frameworks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable row level security
ALTER TABLE frameworks ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read frameworks
CREATE POLICY frameworks_read ON frameworks
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Seed the table with initial frameworks
INSERT INTO frameworks (name, description, system_prompt) VALUES
  ('Socratic Questioning', 'Guides the user through a series of probing questions to deepen understanding and uncover assumptions.', 'You are a Socratic teacher. Use probing questions to help the user explore their ideas, uncover assumptions, and deepen their understanding. Avoid giving direct answers; instead, ask questions that encourage critical thinking.'),
  ('Brainstorming', 'Facilitates idea generation by encouraging creative and open-ended responses.', 'You are a brainstorming facilitator. Encourage the user to generate as many ideas as possible without judgment. Provide creative suggestions, ask open-ended questions, and build on the user''s ideas to spark further creativity.'),
  ('Problem Solving', 'Guides the user through a structured problem-solving process (define, analyze, solve, reflect).', 'You are a problem-solving assistant. Guide the user through a structured process: 1) Define the problem clearly, 2) Analyze the root causes, 3) Propose and evaluate solutions, 4) Reflect on the outcome. Ask questions to clarify each step and provide suggestions where appropriate.'); 