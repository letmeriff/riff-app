# Riff Testing Strategy Implementation Workflow

This document provides a workflow for an AI coding agent to implement the testing strategy for the Riff application. It minimizes context overload by loading essential documents upfront and fetching others as needed, while incorporating automation, validation, and version control for a seamless process.

## Prerequisites

- All testing strategy documents are stored in `./dev-docs/testing-strategy/`.
- A file named `implementation-progress.md` exists in the same directory (create it if absent).
- The AI agent can read/write files in `./dev-docs/testing-strategy/` and modify the codebase.
- Git is initialized in the project root, and the agent can commit changes.

## Test-Driven Development Integration

This workflow incorporates Test-Driven Development (TDD) principles from [TDD-riff](./TDD-riff). When implementing tests:

1. **Start with requirements**, not current implementation
2. **Write failing tests first**, then implement code to make them pass
3. **Document test rationale** with references to requirements
4. **Test for correctness**, not just conformance to existing behavior

## Project Structure Overview

Riff follows a modern full-stack application structure:

- `./app/` - React application with TypeScript

  - `./app/components/` - React components
    - Tests are colocated in `__tests__` directories
  - `./app/lib/` - API clients, services, and Yjs integration
  - `./app/utils/` - Utility functions

- `./server/` - Node.js/Express application with TypeScript

  - `./server/services/` - Service layer
  - `./server/routes/` - API routes
  - `./server/middleware/` - Express middleware
  - Tests are colocated in `__tests__` directories

- `./e2e/` - End-to-end tests using Playwright

- `./test/` - Test utilities and fixtures

## Workflow Steps

### Step 1: Initial Context Gathering and Setup

1. **Read Essential Documents**  
   Load these core documents from `./dev-docs/testing-strategy/`:

   - **`testing-strategy-overview.md`**: Purpose, testing pyramid, key areas, best practices.
   - **`testing-implementation-plan.md`**: Phased approach and weekly tasks.
   - **`testing-tools-environment.md`**: Tools and environment setup.
   - **`TDD-riff`**: Test-Driven Development approach for Riff.

2. **Understand the Basics**  
   Ensure you grasp:

   - Goal: Comprehensive testing for Riff, emphasizing reliability, correctness, and collaboration.
   - Structure: 11-week plan, 6 phases, weekly steps.
   - Tools: Jest, Playwright, etc.
   - TDD Workflow: Red-green-refactor cycle.
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
   - Store the initial documents in memory, refreshing only if modified (e.g., check file timestamps).

### Step 2: Determine Next Subsection

1. **Parse `implementation-progress.md`**

   - Use regex to extract completed tasks.
   - If no matches, start at Phase 1, Week 1, Step 1.
   - Otherwise, find the last completed task and select the next from `testing-implementation-plan.md`.

2. **Update 'In Progress' Section**
   - Add the next task to "In Progress":
     ```
     ## In Progress
     - Phase <PhaseNumber>: Week <WeekNumber> - Step <StepNumber>: <StepTitle>
     ```

### Step 3: Prepare for Implementation

1. **Identify Relevant Documents**

   - Map the subsection to additional documents:
     - **Phase 1**: `testing-tools-environment.md`, `test-data-strategy.md`, `test-examples.md`
     - **Phase 2**: `frontend-testing-strategy.md`, `backend-testing-strategy.md`, `test-examples.md`
     - **Phase 3**: `yjs-testing-strategy.md`, `collaborative-testing-strategy.md`, `test-examples.md`
     - **Phase 4**: `testing-tools-environment.md`, `test-examples.md`
     - **Phase 5**: `testing-tools-environment.md`, `test-examples.md`
   - Always include `TDD-riff` document for guidance on test-driven development

2. **Load and Cache Documents**
   - Fetch the identified documents from `./dev-docs/testing-strategy/`.
   - Cache them in memory, pruning older irrelevant documents.

### Step 4: Discover Relevant Code Files

1. **Identify Target Files for Testing**
   - Use a progressive search strategy to find relevant files:
     - Start with `grep_search` to find code related to the feature being tested.
     - Look for files with relevant naming patterns.
     - Check for existing test files with similar names (e.g., `_.test.ts`, `_.spec.ts`).

2. **Discover Test File Patterns and Locations**
   - Run `list_dir` on key directories to understand how tests are organized.
   - Follow the pattern of colocated tests in `__tests__` directories.

3. **Identify Requirements and Source of Truth**
   - Locate relevant requirements documentation or specifications for the feature.
   - Identify the source of truth for expected behavior before examining the implementation.
   - Document the requirements that each test will validate.

4. **Create a Code Map**
   - Build an in-memory representation of:
     - Files that need to be tested.
     - Existing test files that can be referenced.
     - Mock dependencies that will be needed.
     - Requirements that tests should validate.

### Step 5: Implement the Subsection with TDD

1. **Write Failing Tests First**

   - Start with the expected behavior based on requirements.
   - Create test files with detailed assertions before implementing functionality.
   - Include comments referencing specific requirements or specifications.
   - Follow the AAA pattern (Arrange, Act, Assert).

2. **Implement Code to Pass Tests**

   - Write the minimal code required to make the tests pass.
   - Refactor for improved quality while ensuring tests continue to pass.
   - Document any discrepancies between requirements and current implementation.

3. **Follow Project Patterns**

   - Use existing test files as templates for structure and style.
   - Maintain consistent patterns with the rest of the codebase.
   - Use proper naming conventions for tests.

4. **Apply Best Practices**

   - Use `testing-strategy-overview.md` for AAA pattern, isolation, etc.
   - Test edge cases and error conditions.
   - Isolate tests by mocking dependencies.

5. **Verify Implementation**

   - Run tests to confirm they pass and validate the correct behavior.
   - Check coverage against targets from `testing-strategy-overview.md`.

6. **Handle Discrepancies**
   - If tests fail but current code behavior seems intentional, investigate:
     - Consult requirements documentation
     - Look for comments explaining the behavior
     - Document the discrepancy in "Issues" section of progress tracking
   - Never modify tests just to pass existing code without confirming requirements

### Step 6: Document and Commit Progress

1. **Update `implementation-progress.md`**

   - Move the task from "In Progress" to "Completed Tasks".
   - Add notes with coverage results and TDD implementation details.
   - Clear "In Progress" section.
   - Update "Next Steps".

2. **Commit Changes to Git**
   - Use descriptive commit messages that reference the phase and step.
   - Include TDD steps in commit message (e.g., "Implement with TDD: wrote tests, implemented code, refactored").
   - Push to appropriate branch.

### Step 7: Iterate

- Return to Step 2 to parse progress and select the next subsection.
- Repeat Steps 3-7 until all phases are complete.

## Example TDD Implementation

### Example: Testing Canvas Service

1. **Identify Requirements**:
   - Canvas should support creating, updating, and deleting nodes
   - Changes should be synchronized via Yjs
   - User permissions should be enforced on all operations

2. **Write Failing Tests**:
   ```typescript
   // server/__tests__/services/CanvasService.test.ts
   describe('CanvasService', () => {
     // Reference: REQ-104 Canvas Creation
     it('should create a new canvas with initial Y.Doc structure', async () => {
       // Test code here
     });
     
     // Reference: REQ-105 Canvas Authorization
     it('should reject canvas operations for unauthorized users', async () => {
       // Test code here
     });
   });
   ```

3. **Implement Code**:
   ```typescript
   // server/services/CanvasService.ts
   export class CanvasService {
     // Implementation code here
   }
   ```

4. **Refactor and Verify**:
   - Run tests to verify implementation
   - Refactor for improved design while ensuring tests pass
   - Document any issues or questions about requirements

This example demonstrates how to follow TDD principles while implementing the testing strategy for the Riff application.

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

   - The primary pattern is colocating test files with implementation files.
   - For utility functions without dedicated files or cross-cutting concerns, use the `test-utils` directory.
   - When in doubt, follow the pattern used by the most recent similar test files.

2. **Check Test Configuration**:

   - Jest configuration can provide clues about test locations.
   - Look for testMatch or testRegex patterns.

3. **Create Consistent Structure**:
   - Always create new test files following the established patterns:
     - Component/service/route tests: Same directory as implementation
     - Utility functions without dedicated files: In `test-utils` directory
   - Document any improvements to test organization in `implementation-progress.md`.

## Final Notes

- This workflow balances context efficiency with automation and quality checks.
- File discovery has been enhanced to handle different project structures.
- Fallback strategies are provided for when direct file matches aren't found.
- Escalate to a human supervisor for unresolved issues or clarification.
- Maintain best practices from `testing-strategy-overview.md`.

Let's build Riff's testing strategy with precision and efficiency!
