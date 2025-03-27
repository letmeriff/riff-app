# Riff Testing Strategy Implementation Workflow

This document provides a workflow for an AI coding agent to implement the testing strategy for the Riff application. It minimizes context overload by loading essential documents upfront and fetching others as needed, while incorporating automation, validation, and version control for a seamless process.

## Prerequisites
- All testing strategy documents are stored in `./dev-docs/testing-strategy/`.
- A file named `implementation-progress.md` exists in the same directory (create it if absent).
- The AI agent can read/write files in `./dev-docs/testing-strategy/` and modify the codebase.
- Git is initialized in the project root, and the agent can commit changes.

## Project Structure Overview

Riff follows a modern full-stack application structure:

- `./frontend/` - React application with TypeScript
  - `./frontend/src/` - Source code
    - `./frontend/src/components/` - React components
    - `./frontend/src/services/` - API clients and services
    - `./frontend/src/utils/` - Utility functions
    - Test files are colocated with source files (e.g., `Component.tsx` and `Component.test.tsx`)

- `./backend/` - Node.js/Express application with TypeScript
  - `./backend/src/` - Source code
    - `./backend/src/routes/` - API routes
    - `./backend/src/services/` - Service layer
    - `./backend/src/controllers/` - Controller logic
    - `./backend/src/middleware/` - Express middleware
    - `./backend/src/db/` - Database access
    - Test files are colocated with source files (e.g., `service.ts` and `service.test.ts`)

- `./dev-docs/` - Development documentation
  - `./dev-docs/testing-strategy/` - Testing strategy documentation

## Workflow Steps

### Step 1: Initial Context Gathering and Setup
1. **Read Essential Documents**  
   Load these core documents from `./dev-docs/testing-strategy/`:
   - **`testing-strategy-overview.md`**: Purpose, testing pyramid, key areas, best practices.
   - **`testing-implementation-plan.md`**: Phased approach and weekly tasks.
   - **`testing-tools-environment.md`**: Tools and environment setup.

2. **Understand the Basics**  
   Ensure you grasp:
   - Goal: Comprehensive testing for Riff, emphasizing reliability, correctness, and collaboration.
   - Structure: 11-week plan, 6 phases, weekly steps.
   - Tools: Jest, Playwright, etc.
   - Progress: Tracked in `implementation-progress.md`.

3. **Initialize `implementation-progress.md` (if needed)**  
   - Location: `./dev-docs/testing-strategy/implementation-progress.md`
   - If absent, create with:
     ```
     # Implementation Progress

     ## Completed Tasks

     ## In Progress

     ## Issues

     ## Next Steps
     ```

4. **Cache Documents**  
   - Store the initial three documents in memory, refreshing only if modified (e.g., check file timestamps).

### Step 2: Determine Next Subsection
1. **Parse `implementation-progress.md`**  
   - Use regex (e.g., `-\s*\[x\]\s*Phase\s*(\d+):\s*Week\s*(\d+)\s*-\s*Step\s*(\d+):[^\n]*`) to extract completed tasks.
   - If no matches, start at Phase 1, Week 1, Step 1.
   - Otherwise, find the last completed task and select the next from `testing-implementation-plan.md`:
     - Phase 1: Core Testing Infrastructure (Weeks 1-2)
       - Week 1: Step 1, Step 2, Step 3
       - Week 2: Step 1, Step 2, Step 3
     - Phase 2: Component and Service Coverage (Weeks 3-5)
       - Week 3: Step 1, Step 2, Step 3
       - Week 4: Step 1, Step 2, Step 3
       - Week 5: Step 1, Step 2, Step 3
     - Phase 3: Collaborative Feature Testing (Weeks 6-8)
       - Week 6: Step 1, Step 2, Step 3
       - Week 7: Step 1, Step 2, Step 3
       - Week 8: Step 1, Step 2, Step 3
     - Phase 4: Performance and Stress Testing (Weeks 9-10)
       - Week 9: Step 1, Step 2, Step 3
       - Week 10: Step 1, Step 2, Step 3
     - Phase 5: User Acceptance and Accessibility Testing (Week 11)
       - Week 11: Step 1, Step 2, Step 3
     - Phase 6: Continuous Improvement (Ongoing, skip unless instructed)

2. **Update 'In Progress' Section**  
   - Add the next task to "In Progress":
     ```
     ## In Progress
     - Phase <PhaseNumber>: Week <WeekNumber> - Step <StepNumber>: <StepTitle>
     ```

### Step 3: Prepare for Implementation
1. **Identify Relevant Documents**  
   - Map the subsection to additional documents:
     - **Phase 1: Core Testing Infrastructure**
       - Week 1, Step 1: `testing-tools-environment.md`
       - Week 1, Step 2: `test-data-strategy.md`, `test-examples.md`
       - Week 1, Step 3: `testing-tools-environment.md`
       - Week 2, Step 1: `frontend-testing-strategy.md`, `test-examples.md`
       - Week 2, Step 2: `backend-testing-strategy.md`, `test-examples.md`
       - Week 2, Step 3: None additional
     - **Phase 2: Component and Service Coverage**
       - Week 3: `frontend-testing-strategy.md`, `test-examples.md`
       - Week 4: `backend-testing-strategy.md`, `test-examples.md`
       - Week 5: `backend-testing-strategy.md`, `test-examples.md`
     - **Phase 3: Collaborative Feature Testing**
       - Week 6: `yjs-testing-strategy.md`, `test-examples.md`
       - Week 7: `collaborative-testing-strategy.md`, `test-examples.md`
       - Week 8: `collaborative-testing-strategy.md`, `test-examples.md`
     - **Phase 4: Performance and Stress Testing**
       - Week 9: `testing-tools-environment.md`, `test-examples.md`
       - Week 10: `testing-tools-environment.md`, `test-examples.md`
     - **Phase 5: User Acceptance and Accessibility Testing**
       - Week 11: `testing-tools-environment.md`, `test-examples.md`

2. **Load and Cache Documents**  
   - Fetch only the identified documents from `./dev-docs/testing-strategy/`.
   - Cache them in memory, pruning older irrelevant documents (keep only initial three + current step's docs).

### Step 4: Discover Relevant Code Files
1. **Identify Target Files for Testing**
   - Use a progressive search strategy to find relevant files:
     - Start with `grep_search` to find code related to the feature being tested (e.g., "canvas", "user", "yjs").
     - Look for files with relevant naming patterns (e.g., "canvasService", "userRoutes").
     - Check for existing test files with similar names (e.g., "*.test.ts", "*.spec.ts").
   
2. **Discover Test File Patterns and Locations**
   - Run `list_dir` on key directories to understand how tests are organized:
     - Check both `/frontend/src` and `/backend/src` directories.
     - Look for patterns like `__tests__` directories or colocated test files.
     - Note whether tests are in the same directory as implementation or in a separate structure.

3. **Identify File Relationships**
   - For each implementation file that needs testing:
     - Check if a test file already exists.
     - Determine where new test files should be created based on project patterns.
     - Map dependencies that will need to be mocked.

4. **Create a Code Map**
   - Build an in-memory representation of:
     - Files that need to be tested.
     - Existing test files that can be referenced.
     - Mock dependencies that will be needed.
     - Test utilities/fixtures that can be reused.

### Step 5: Implement the Subsection
1. **Execute the Task**  
   - Follow instructions in `testing-implementation-plan.md` for the subsection.
   - Use loaded documents for guidance (e.g., `test-examples.md` for patterns).
   - Example: "Week 1, Step 1 - Configure Testing Frameworks":
     - Set up Jest/ts-jest per `testing-tools-environment.md`.
     - Create `jest.config.js` files.

2. **Follow Project Patterns**
   - Use existing test files as templates for structure and style.
   - Maintain consistent patterns with the rest of the codebase.
   - Use proper naming conventions for tests.

3. **Apply Best Practices**  
   - Use `testing-strategy-overview.md` for AAA pattern, isolation, etc.

4. **Generate Test Data (if needed)**  
   - Refer to `test-data-strategy.md` when loaded (e.g., Week 1, Step 2).

5. **Verify Implementation**  
   - Run tests (e.g., `npm run test:unit`) to confirm success.
   - Run `npm run coverage` and check against 80% goal from `testing-strategy-overview.md`.

6. **Handle Errors**  
   - If tests fail or coverage is below 80%, log in "Issues":
     ```
     ## Issues
     - Phase <PhaseNumber>: Week <WeekNumber> - Step <StepNumber>: <StepTitle>
       Details: <Error description, e.g., "Coverage at 75%, missing edge cases">
     ```
   - Retry once; if still failing, escalate to supervisor.

### Step 6: Document and Commit Progress
1. **Update `implementation-progress.md`**  
   - Move the task from "In Progress" to "Completed Tasks":
     ```
     ## Completed Tasks
     - [x] Phase <PhaseNumber>: Week <WeekNumber> - Step <StepNumber>: <StepTitle>
     ```
   - Add notes with coverage results:
     ```
     Notes: Set up Jest and ts-jest with jest.config.js files. Coverage: 82%.
     ```
   - Clear "In Progress" section.
   - Update "Next Steps":
     ```
     ## Next Steps
     - Phase <NextPhase>: Week <NextWeek> - Step <NextStep>: <NextTitle>
     ```

2. **Commit Changes to Git**  
   - Commit with message: `git commit -m "Implement Phase <PhaseNumber> Week <WeekNumber> Step <StepNumber>"`.
   - Note commit hash in notes:
     ```
     Notes: ... Commit: abc123
     ```
   - Push to a branch (e.g., `feature/testing-strategy`): `git push origin feature/testing-strategy`.

### Step 7: Iterate
- Return to Step 2 to parse progress and select the next subsection.
- Repeat Steps 3-7 until Phases 1-5 are complete (skip Phase 6 unless instructed).

## Example Workflow Execution with File Discovery

### Example: Implementing Canvas Service Tests

1. **Parse Progress**: Determine we need to implement Phase 2, Week 4, Step 2: Canvas Service.

2. **Discover Canvas Service Files**:
   - Search with `grep_search` for "canvas" in key directories (services, routes, controllers).
   - If no direct match for "canvasService.ts", look for files containing canvas-related functionality.
   - Check for patterns like `*Canvas*.ts` or references to canvas in other files.

3. **Identify Test Structure**:
   - Check if there are existing test files colocated with source files.
   - Examine how other services are tested (e.g., userService.test.ts).
   - Determine whether tests should be in same directory or in a `__tests__` folder.

4. **Create Test File**:
   - Based on discovered patterns, create a new test file (e.g., "yjsCanvasService.test.ts").
   - Follow existing test patterns to maintain consistency.

5. **Implement Tests**:
   - Test canvas CRUD operations (create, read, update, delete).
   - Test canvas sharing and permissions.
   - Test canvas metadata management.

6. **Verify and Document**:
   - Run tests to confirm functionality.
   - Update implementation progress document with results.

## Troubleshooting and Fallback Strategies

### When Files Cannot Be Located

1. **Broaden Search Scope**:
   - Start with specific terms (e.g., "canvasService") then broaden (e.g., "canvas").
   - Search in all source directories if targeted search fails.
   - Look for related functionality in integration points (index.ts, app.ts).

2. **Check Alternative Implementations**:
   - The feature might be implemented differently than expected (e.g., canvas functionality might be in a generic "documentService").
   - Check for domain-specific terminology differences.

3. **Use Database Schema as Guide**:
   - Examine database tables and columns to understand data model.
   - Look for code that manipulates these tables.

### When Test Structure Is Unclear

1. **Follow Project Conventions**:
   - Look at how the majority of tests are structured.
   - Examine recently added tests as they're likely to follow current conventions.

2. **Check Test Configuration**:
   - Jest configuration can provide clues about test locations.
   - Look for testMatch or testRegex patterns.

3. **Create Consistent Structure**:
   - If test structure is inconsistent, document this issue.
   - Propose standardization as part of ongoing improvements.

## Final Notes
- This workflow balances context efficiency with automation and quality checks.
- File discovery has been enhanced to handle different project structures.
- Fallback strategies are provided for when direct file matches aren't found.
- Escalate to a human supervisor for unresolved issues or clarification.
- Maintain best practices from `testing-strategy-overview.md`.

Let's build Riff's testing strategy with precision and efficiency!