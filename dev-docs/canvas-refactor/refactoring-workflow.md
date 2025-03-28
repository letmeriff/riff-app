# Canvas Refactoring Implementation Workflow

This document provides a structured workflow for implementing the CanvasPage component refactoring. It minimizes context overload by loading essential documents upfront and fetching others as needed, while maintaining progress tracking and ensuring quality through incremental changes and continuous testing.

## Prerequisites

- All canvas refactoring documents are stored in `./dev-docs/canvas-refactor/`.
- A file named `refactoring-progress.md` exists in the same directory (create it if absent).
- The developer can read/write files in the project codebase.
- Git is initialized in the project root, and changes can be committed.

## Test-Driven Development Integration

This workflow incorporates Test-Driven Development (TDD) principles:

1. **Write tests first** for each component or hook being extracted
2. **Document test rationale** with references to requirements
3. **Implement the minimal code** to make tests pass
4. **Refactor** for improved design while keeping tests passing
5. **Verify feature parity** with the original implementation

## Project Structure Overview

The refactored Canvas components will follow this structure:

- `./frontend/src/components/Canvas/` - Core canvas components
  - `./frontend/src/components/Canvas/index.tsx` - Main export
  - `./frontend/src/components/Canvas/CanvasPage.tsx` - Container component
  - `./frontend/src/components/Canvas/Canvas.tsx` - ReactFlow wrapper
  - `./frontend/src/components/Canvas/components/` - Subcomponents

- `./frontend/src/hooks/canvas/` - Custom canvas hooks
  - `./frontend/src/hooks/canvas/useCanvasNodes.ts`
  - `./frontend/src/hooks/canvas/useCanvasEdges.ts`
  - `./frontend/src/hooks/canvas/useYjsIntegration.ts`
  - etc.

- `./frontend/src/contexts/CanvasContext.tsx` - Canvas context provider

- `./frontend/src/types/canvas.ts` - Canvas type definitions

## Workflow Steps

### Step 1: Initial Context Gathering and Setup

1. **Read Essential Documents**  
   Load these core documents from `./dev-docs/canvas-refactor/`:

   - **`refactoring-strategy.md`**: Analysis of current issues and goals.
   - **`implementation-plan.md`**: Detailed phases and timeline.
   - **`component-architecture.md`**: Component hierarchy and data flow.
   - **`testing-strategy.md`**: Testing approach for new components.

2. **Understand the Basics**  
   Ensure you grasp:

   - Current Problems: Complex component with mixed responsibilities and testing challenges.
   - Goals: Separation of concerns, improved testability, maintainability, and performance.
   - Approach: Extract hooks, decompose components, follow container/presenter pattern.
   - Component Architecture: New hierarchy and relationships between components.

3. **Initialize `refactoring-progress.md` (if needed)**

   - Location: `./dev-docs/canvas-refactor/refactoring-progress.md`
   - If absent, create with:

     ```
     # Canvas Refactoring Progress

     ## Completed Tasks

     ## In Progress

     ## Issues

     ## Next Steps
     ```

4. **Set Up Project Structure**
   - Create the necessary directories for the new components and hooks
   - Configure build and test settings for the new structure

### Step 2: Determine Next Subsection

1. **Parse `refactoring-progress.md`**

   - Extract completed tasks to determine the current phase and step.
   - If no matching entries, start at Phase 1, Step 1.
   - Otherwise, find the last completed task and select the next from `implementation-plan.md`.

2. **Update 'In Progress' Section**
   - Add the next task to "In Progress":
     ```
     ## In Progress
     - Phase <PhaseNumber>: Step <StepNumber>: <StepTitle>
     ```

### Step 3: Prepare for Implementation

1. **Analyze Current Implementation**

   - Examine the current CanvasPage component to understand the functionality being refactored.
   - Identify the specific dependencies and state variables related to the current task.
   - Find related components and utilities that interact with the functionality.

2. **Identify Test Requirements**

   - Determine what behaviors need to be verified for the extracted functionality.
   - Identify edge cases and potential issues to test.
   - Plan test fixtures and mocks needed for isolated testing.

3. **Create Implementation Plan**
   - Break down the task into smaller steps.
   - Define the API for hooks or component interfaces.
   - Plan any necessary migration or backward compatibility measures.

### Step 4: Implement with Test-Driven Development

1. **Write Tests First**

   - Create test file for the hook or component being implemented.
   - Write comprehensive tests covering expected behavior.
   - Include tests for error handling and edge cases.
   - Ensure tests fail initially (red phase).

2. **Implement Functionality**

   - Write the minimal code to make tests pass (green phase).
   - Extract code from the original CanvasPage component as needed.
   - Adapt the code to fit the new architecture.

3. **Refactor for Quality**

   - Improve code quality while keeping tests passing.
   - Address any technical debt introduced during implementation.
   - Ensure the code follows project conventions and best practices.

4. **Document the Implementation**
   - Add JSDoc comments to exported functions and components.
   - Document any non-obvious implementation details.
   - Update relevant architecture documents if design changes were made.

### Step 5: Integrate with Existing Code

1. **Update Dependencies**

   - Modify code that depends on the refactored functionality.
   - Update imports and references.
   - Ensure backward compatibility if needed.

2. **Run Integration Tests**

   - Test integration with other components and systems.
   - Verify that the overall application still works correctly.
   - Check for performance impacts or regressions.

3. **Address Integration Issues**
   - Fix any issues that arise during integration.
   - Update tests to cover integration edge cases.
   - Document any challenges or workarounds.

### Step 6: Document and Commit Progress

1. **Update `refactoring-progress.md`**

   - Move the task from "In Progress" to "Completed Tasks".
   - Add notes about implementation details, test coverage, and any issues.
   - Update "Next Steps" with the upcoming tasks.

2. **Commit Changes to Git**
   - Use descriptive commit messages referencing the phase and step.
   - Include test coverage metrics in the commit message.
   - Push to the appropriate branch.

### Step 7: Iterate

- Return to Step 2 to determine the next task.
- Repeat Steps 3-6 until all phases are complete.

## Phase-Specific Guidelines

### Phase 1: Preparation and Testing

- Focus on building solid test utilities and fixtures.
- Document patterns and examples for testing different types of components.
- Establish coding standards and architecture guidelines.

### Phase 2: Custom Hooks Extraction

- Start with simpler hooks like `useCanvasNodes` and `useCanvasEdges`.
- Gradually move to more complex hooks like `useYjsIntegration`.
- Ensure hooks are independent and well-tested before moving to components.

### Phase 3: Component Decomposition

- Begin with the core Canvas component.
- Test component integration with hooks.
- Verify rendering behavior with different props configurations.

### Phase 4: Integration and Performance

- Pay special attention to performance metrics.
- Implement progressive integration to minimize disruption.
- Document any performance optimizations applied.

### Phase 5: Cleanup and Review

- Conduct thorough code reviews.
- Ensure documentation is complete and accurate.
- Verify test coverage meets targets.

## Example TDD Implementation

### Example: Implementing useCanvasNodes Hook

1. **Write Test First**:
   ```typescript
   // frontend/src/hooks/canvas/__tests__/useCanvasNodes.test.ts
   import { renderHook, act } from '@testing-library/react-hooks';
   import { useCanvasNodes } from '../useCanvasNodes';
   import * as nodeService from '../../../services/nodeService';

   // Mock dependencies
   jest.mock('../../../services/nodeService');
   jest.mock('../../../contexts/AuthContext', () => ({
     useAuth: () => ({ user: { id: 'test-user' } })
   }));
   jest.mock('../../../contexts/YjsContext', () => ({
     useYjs: () => ({ 
       isConnected: true, 
       ydoc: {}, 
       getNodesFromYjs: jest.fn().mockReturnValue([]) 
     })
   }));

   describe('useCanvasNodes', () => {
     beforeEach(() => {
       jest.clearAllMocks();
     });

     it('should load nodes on initialization', async () => {
       // Mock fetchNodes to return test data
       (nodeService.fetchNodes as jest.Mock).mockResolvedValue([
         { node_id: 1, title: 'Test Node', position_x: 100, position_y: 100 }
       ]);

       const { result, waitForNextUpdate } = renderHook(() => useCanvasNodes());
       
       // Initially in loading state
       expect(result.current.loading).toBe(true);
       
       await waitForNextUpdate();
       
       // After loading
       expect(result.current.loading).toBe(false);
       expect(result.current.nodes.length).toBe(1);
       expect(result.current.nodes[0].id).toBe('1');
     });

     // Additional tests for other functionality
   });
   ```

2. **Implement Functionality**:
   Extract the hook from CanvasPage, following the pattern in the example implementation.

3. **Refactor and Verify**:
   Run tests to verify implementation and improve the design where needed.

## Troubleshooting and Fallback Strategies

### When Functionality Is Hard to Extract

1. **Incremental Approach**:
   - Extract functionality in smaller pieces.
   - Maintain backward compatibility temporarily.
   - Consider using adapter patterns for transitional periods.

2. **Duplicate and Replace**:
   - Implement new components alongside the original.
   - Switch over gradually once the new implementation is stable.
   - Remove original code after successful migration.

### When Tests Are Difficult to Write

1. **Improve Testability First**:
   - Create better mocks and test utilities.
   - Simplify the component interface.
   - Break dependencies into smaller, more manageable pieces.

2. **Integration Testing**:
   - When unit testing is too complex, start with integration tests.
   - Gradually refine into smaller unit tests as the design improves.

## Continuous Integration

All changes should be integrated with the CI/CD pipeline:

- Run unit tests on every commit.
- Track test coverage to ensure it meets targets.
- Monitor performance metrics for regressions.
- Document any CI failures and their resolutions.

## Success Criteria

The refactoring will be considered successful when:

1. All phases of the implementation plan are completed.
2. Test coverage is above 90% for new code.
3. Component responsibilities are clearly separated.
4. Performance meets or exceeds the original implementation.
5. Code is more maintainable and easier to understand.

## Final Notes

- This workflow balances structured approach with flexibility.
- Test-driven development ensures quality throughout the refactoring.
- Documentation and progress tracking provide visibility and continuity.
- Incremental changes minimize disruption to the codebase.

The refactoring strategy aims to transform CanvasPage from a complex, difficult-to-test component into a modular, well-tested, and maintainable system of components and hooks. 