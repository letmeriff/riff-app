# SQL Scripts

This directory contains SQL scripts for setting up database functions and triggers.

## Summarization Trigger

The `summarization_trigger.sql` file creates a database function and trigger that automatically flags chat histories for summarization when they reach a threshold (50 messages). To use this:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Copy the contents of `summarization_trigger.sql`
4. Paste into a new SQL query
5. Execute the query

After this is set up, the following will happen:
- When a node reaches 50 chat messages, a new entry will be added to the `chat_summaries` table with `summary: "Pending summarization..."`
- The scheduled job in the backend will detect this entry and process it, generating an actual summary using the LangChain integration
- The entry in the `chat_summaries` table will be updated with the real summary
- Users can pull summaries using the "Summary" option in the Pull dropdown 