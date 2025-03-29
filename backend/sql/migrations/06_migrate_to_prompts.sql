-- Migration script to convert from frameworks to prompts system

-- Step 1: Create a backup of the frameworks table
CREATE TABLE frameworks_backup AS SELECT * FROM frameworks;

-- Step 2: Remove the foreign key constraint on chat_nodes
ALTER TABLE chat_nodes DROP CONSTRAINT IF EXISTS chat_nodes_framework_fkey;

-- Step 3: Then drop the framework column from chat_nodes
ALTER TABLE chat_nodes DROP COLUMN IF EXISTS framework;

-- Step 4: Now drop the frameworks table
DROP TABLE IF EXISTS frameworks;

-- Step 5: Create the new prompts table
CREATE TABLE prompts (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('framework', 'template')), -- Differentiate between frameworks and templates
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  prompt TEXT NOT NULL, -- Renamed from system_prompt to reflect its usage
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Step 6: Allow all authenticated users to read prompts
CREATE POLICY prompts_read ON prompts
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Step 7: Seed the table with initial frameworks and templates
INSERT INTO prompts (type, name, description, prompt) VALUES
  ('framework', 'Socratic Questioning', 'Guides the user through a series of probing questions to deepen understanding and uncover assumptions.', 'You are a Socratic teacher. Use probing questions to help me explore my ideas, uncover assumptions, and deepen my understanding. Avoid giving direct answers; instead, ask questions that encourage critical thinking. Let''s begin.'),
  ('framework', 'Brainstorming', 'Facilitates idea generation by encouraging creative and open-ended responses.', 'You are a brainstorming facilitator. Encourage me to generate as many ideas as possible without judgment. Provide creative suggestions, ask open-ended questions, and build on my ideas to spark further creativity. Let''s start brainstorming.'),
  ('framework', 'Problem Solving', 'Guides the user through a structured problem-solving process (define, analyze, solve, reflect).', 'You are a problem-solving assistant. Guide me through a structured process: 1) Define the problem clearly, 2) Analyze the root causes, 3) Propose and evaluate solutions, 4) Reflect on the outcome. Ask questions to clarify each step and provide suggestions where appropriate. Let''s solve a problem together.'),
  ('template', 'Product Feedback Interview', 'Conducts a structured interview to gather product feedback.', 'You are a product feedback interviewer. Conduct a structured interview to gather feedback on a product. Ask the following questions in order: 1) What do you generally think about the product? 2) What do you like most about it? 3) What do you dislike or find challenging? 4) How could the product be improved? 5) Would you recommend this product to others, and why? Respond to my answers with follow-up questions to dig deeper, and summarize the feedback at the end.'),
  ('template', 'SWOT Analysis', 'Guides the user through a SWOT analysis (Strengths, Weaknesses, Opportunities, Threats).', 'You are a business analyst. Guide me through a SWOT analysis for a project, product, or organization. Ask me to identify: 1) Strengths, 2) Weaknesses, 3) Opportunities, 4) Threats. For each section, ask probing questions to help me think deeply, and provide suggestions if I''m stuck. At the end, summarize the SWOT analysis and suggest next steps.'); 