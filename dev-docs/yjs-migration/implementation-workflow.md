# Workflow Document: Yjs Migration Implementation

## Objective

This workflow instructs an AI coding agent to assist in transitioning a collaborative canvas application to use Yjs, as outlined in the "Yjs Migration Developer Brief" and "Implementation Plan: Transitioning to Yjs." The agent will systematically work through the implementation plan, track progress, and document updates in `implementation-progress.md`.

## Prerequisites

- Access to the "Yjs Migration Developer Brief" document.
- Access to the "Implementation Plan: Transitioning to Yjs" document.
- Write access to a file named `implementation-progress.md` in the project directory.
- Familiarity with the project’s existing codebase and technologies (React, React Flow, Node.js, Socket.IO, Supabase).

## Workflow Steps

### Step 1: Initial Setup

1. **Read the Developer Brief**:

   - Open and thoroughly read the "Yjs Migration Developer Brief" to understand the current system architecture, limitations, and migration goals.
   - Take note of key components (e.g., `nodeService.ts`, `CanvasPage.tsx`, `index.ts`) and the custom CRDT implementation being replaced.

2. **Read the Implementation Plan**:

   - Open and review the "Implementation Plan: Transitioning to Yjs" to understand the structured approach to the migration.
   - Familiarize yourself with the numbered sections (1.1, 1.2, 2.1, etc.) and their dependencies.

3. **Check Current Progress**:

   - Open the `implementation-progress.md` file.
   - If the file does not exist, create it with the following initial structure:

     ```markdown
     # Yjs Implementation Progress

     ## Completed Sections

     - None

     ## In Progress

     - None

     ## Next Steps

     - 1.1 Data Structure Design
     ```

   - Review the "Completed Sections" and "In Progress" sections to determine which subsection of the implementation plan has been completed or is currently being worked on.

### Step 2: Identify Next Task

1. **Determine the Next Subsection**:

   - Refer to the "Next Steps" section in `implementation-progress.md`.
   - If "Next Steps" is empty or points to an invalid subsection, scan the implementation plan starting from section 1.1 and select the first uncompleted subsection not listed under "Completed Sections" or "In Progress."
   - Example: If `implementation-progress.md` shows 1.1 as completed and nothing in progress, the next subsection is 1.2.

2. **Validate Dependencies**:
   - Before proceeding, check the implementation plan to ensure all prerequisite subsections for the selected task are completed (e.g., 2.1 may depend on 1.1 being done).
   - If dependencies are unmet, adjust the next task to the earliest uncompleted prerequisite and note this in `implementation-progress.md`.

### Step 3: Implement the Subsection

1. **Understand the Task**:

   - Read the selected subsection in the implementation plan (e.g., "1.1 Data Structure Design").
   - Cross-reference with the developer brief for context (e.g., how nodes and edges are currently managed).

2. **Code Implementation**:

   - Write or modify code as specified in the subsection.
   - Use the technical resources and example patterns from the developer brief (e.g., Yjs documentation, React Flow integration).
   - Follow the "Implementation Approach" from the plan (parallel development, clean separation).
   - Test the implementation locally to ensure it meets the subsection’s requirements.

3. **Handle Edge Cases**:
   - Address any "Common Pitfalls" or "Implementation Considerations" noted in the developer brief (e.g., document size for large canvases).
   - If clarification is needed, flag the issue in `implementation-progress.md` under "Notes" and proceed with a reasonable assumption.

### Step 4: Document Progress

1. **Update `implementation-progress.md`**:

   - Move the completed subsection from "In Progress" or "Next Steps" to "Completed Sections."
   - Add a brief summary of what was implemented, including:
     - Files modified or created.
     - Key decisions or assumptions made.
     - Any challenges encountered and how they were resolved.
   - Example entry:
     ```markdown
     ## Completed Sections

     - 1.1 Data Structure Design
       - Implemented Yjs document structure in `frontend/src/yjsSetup.ts`.
       - Defined Y.Map for nodes and edges, mapped node positions and metadata.
       - Tested with a small canvas locally.
     ```
   - Update "In Progress" to reflect the current task (if multi-step) or leave it empty.
   - Update "Next Steps" to point to the next subsection (e.g., 1.2 after 1.1).

2. **Commit Changes**:
   - Stage and commit code changes with a message referencing the subsection (e.g., "Implement 1.1 Data Structure Design").
   - Push changes to the repository if applicable.

### Step 5: Iterate

1. **Move to the Next Subsection**:

   - Return to Step 2 and repeat the process for the next uncompleted subsection.
   - Continue until all subsections in the implementation plan are marked as completed in `implementation-progress.md`.

2. **Handle Completion**:

   - Once all subsections are completed, update `implementation-progress.md` with a final note:

     ```markdown
     ## Completed Sections

     - [List all subsections]

     ## In Progress

     - None

     ## Next Steps

     - Implementation complete. Review and test full Yjs integration.
     ```

## Additional Guidelines

- **Error Handling**: If an implementation step fails (e.g., dependency issues, unclear requirements), document the problem in `implementation-progress.md` under a "Blocked" section and move to the next independent subsection.
- **Collaboration**: If multiple agents or humans are working on this, check `implementation-progress.md` before starting to avoid conflicts, and lock a subsection by marking it "In Progress" with your identifier (e.g., "AI-Agent-1").
- **Feedback Loop**: Periodically review completed sections for consistency with the overall goal (e.g., offline support, awareness features) and adjust if necessary.

## Example `implementation-progress.md`

```markdown
# Yjs Implementation Progress

## Completed Sections

- 1.1 Data Structure Design
  - Created `frontend/src/yjsSetup.ts` with Y.Doc, Y.Map for nodes/edges.
  - Tested basic structure with mock data.

## In Progress

- 1.2 Database Schema Updates
  - Working on `yjs_documents` table creation.

## Next Steps

- 2.1 Yjs Server Integration

## Notes

- Assumed binary storage format for updates; may need validation.
```
