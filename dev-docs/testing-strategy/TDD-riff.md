# Test-Driven Development (TDD) Workflow for RIFF App

## 1. Introduction

This document provides a comprehensive guide for designing and implementing tests in a Test-Driven Development (TDD) workflow for the RIFF app. TDD involves writing tests before writing the code to implement the functionality, ensuring that the codebase is robust, maintainable, and aligned with requirements. The RIFF app is a collaborative idea exploration engine with a node-based canvas, AI chat instances, real-time collaboration via Yjs, and context management features. This document outlines the testing strategy, tools, and specific test cases for each major feature, ensuring thorough coverage across all development phases.

### Goals of TDD for RIFF

- Ensure each feature meets its requirements before implementation.
- Catch bugs early in the development cycle.
- Facilitate refactoring by providing a safety net of tests.
- Improve code quality and maintainability.
- Support continuous integration and deployment (CI/CD) with automated testing.

---

## 2. Testing Strategy

### 2.1 Testing Levels

The TDD workflow for RIFF will include three levels of testing:

1. **Unit Tests**:

   - Test individual functions, components, and services in isolation.
   - Focus on small, independent units of code (e.g., a function to pull chat history, a React component for a node).
   - Use mocking to isolate dependencies (e.g., mock Supabase database calls, mock LangChain responses, mock Yjs documents).

2. **Integration Tests**:

   - Test interactions between components or services (e.g., API endpoints, Yjs shared documents, database operations).
   - Ensure that integrated components work together as expected (e.g., pulling context from one node to another).

3. **End-to-End (E2E) Tests**:
   - Test complete user flows in a production-like environment (e.g., creating a node, sending a message, collaborating with another user).
   - Simulate real user interactions using a browser automation tool.

### 2.2 Testing Tools

The following tools will be used for testing at each level:

- **Unit Testing**:

  - **Jest**: Testing framework for JavaScript/TypeScript (backend and frontend).
  - **React Testing Library**: For testing React components (frontend).
  - **ts-mockito** or **Sinon.js**: For mocking dependencies (e.g., Supabase client, LangChain).
  - **y-protocols/testing**: For mocking Yjs documents and operations.

- **Integration Testing**:

  - **Supertest**: For testing API endpoints (backend).
  - **y-websocket/mock**: For testing Yjs WebSocket provider.
  - **Jest**: For orchestrating integration tests.

- **End-to-End Testing**:

  - **Playwright**: For browser-based E2E testing.
  - **Playwright Page Objects**: For organizing and structuring E2E tests.

- **Test Utilities**:

  - **Supabase JavaScript Client**: For interacting with Supabase in integration tests.
  - **node-mocks-http**: For mocking HTTP requests in backend tests.
  - **msw** (Mock Service Worker): For mocking API responses in frontend tests.
  - **y-test-utils**: Custom utilities for testing Yjs operations and synchronization.

- **CI/CD Integration**:
  - **GitHub Actions**: Run tests automatically on pull requests, merges, and deployments.

### 2.3 TDD Workflow

For each feature or task in the development roadmap, follow these steps:

1. **Write a failing test** (red): Define the expected behavior in a test case.
2. **Write the minimal code to pass the test** (green): Implement just enough code to make the test pass.
3. **Refactor**: Improve the code while ensuring all tests still pass.
4. **Repeat**: Add more test cases to cover edge cases, errors, and additional requirements.

### 2.4 Test Coverage Goals

- Aim for at least 80% test coverage for critical components (e.g., backend services, context management, collaboration logic).
- Prioritize testing for user-facing features (e.g., chat UI, node interactions) and critical backend logic (e.g., context pulling, write permissions).
- Use Jest's coverage reports to identify untested areas and improve coverage over time.

---

## 3. Test Setup

### 3.1 Project Structure

Organize tests within the monorepo to mirror the source code structure:

```
riff-app/
  ├── app/
  │   ├── components/
  │   │   ├── Chat/
  │   │   │   ├── ChatNode.tsx
  │   │   │   └── ChatUI.tsx
  │   │   └── __tests__/
  │   │       ├── Chat/
  │   │       │   ├── ChatNode.test.tsx
  │   │       │   └── ChatUI.test.tsx
  │   ├── lib/
  │   │   ├── api.ts
  │   │   ├── yjs/
  │   │   │   ├── YjsProvider.ts
  │   │   │   └── useYjsAwareness.ts
  │   │   └── __tests__/
  │   │       ├── api.test.ts
  │   │       └── yjs/
  │   │           ├── YjsProvider.test.ts
  │   │           └── useYjsAwareness.test.ts
  │   └── utils/
  │       ├── context.ts
  │       └── __tests__/
  │           └── context.test.ts
  ├── server/
  │   ├── services/
  │   │   ├── ChatService.ts
  │   │   └── ContextService.ts
  │   ├── routes/
  │   │   └── chatRoutes.ts
  │   └── __tests__/
  │       ├── services/
  │       │   ├── ChatService.test.ts
  │       │   └── ContextService.test.ts
  │       └── routes/
  │           └── chatRoutes.test.ts
  ├── e2e/
  │   ├── canvas.spec.ts
  │   └── collaboration.spec.ts
  └── test/
      ├── fixtures/
      │   └── mockData.json
      └── utils/
          └── yjs-test-utils.ts
```

This structure follows the current project organization, with tests colocated in `__tests__` directories adjacent to the code they test. End-to-end tests are stored in a dedicated `e2e` directory, and test utilities and fixtures are centralized in the `test` directory.

### 3.2 Setup Instructions

1. **Install Dependencies**:

   - Frontend: `npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest msw`.
   - Backend: `npm install --save-dev jest supertest ts-jest node-mocks-http`.
   - Yjs Testing: `npm install --save-dev y-protocols y-indexeddb y-websocket`
   - E2E: `npm install --save-dev @playwright/test`

2. **Configure Jest**:

   - Add a `jest.config.js` file for both frontend and backend with TypeScript support:

     ```javascript
     // Frontend jest.config.js
     module.exports = {
       preset: 'ts-jest',
       testEnvironment: 'jsdom',
       setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
       moduleNameMapper: {
         // Add module name mappers for CSS, assets, etc.
         '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
         '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
       },
       transform: {
         '^.+\\.(ts|tsx)$': 'ts-jest',
       },
       testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
     };

     // Backend jest.config.js
     module.exports = {
       preset: 'ts-jest',
       testEnvironment: 'node',
       transform: {
         '^.+\\.(ts|tsx)$': 'ts-jest',
       },
       testMatch: ['**/__tests__/**/*.test.ts'],
     };
     ```

3. **Configure Playwright**:

   - Run `npx playwright install` to install browser binaries
   - Create a playwright.config.ts file:

     ```typescript
     import { PlaywrightTestConfig } from '@playwright/test';

     const config: PlaywrightTestConfig = {
       testDir: './e2e',
       timeout: 30000,
       forbidOnly: !!process.env.CI,
       retries: process.env.CI ? 2 : 0,
       reporter: 'html',
       use: {
         baseURL: 'http://localhost:3000',
         trace: 'on-first-retry',
         screenshot: 'only-on-failure',
       },
       projects: [
         {
           name: 'chromium',
           use: { browserName: 'chromium' },
         },
       ],
     };

     export default config;
     ```

4. **Setup Yjs Testing Utilities**:

   - Create a `test-utils/yjs.ts` file for Yjs testing utilities:

     ```typescript
     import * as Y from 'yjs';

     export const createTestDoc = () => {
       return new Y.Doc();
     };

     export const syncDocs = (doc1: Y.Doc, doc2: Y.Doc) => {
       const update1 = Y.encodeStateAsUpdate(doc1);
       const update2 = Y.encodeStateAsUpdate(doc2);
       Y.applyUpdate(doc1, update2);
       Y.applyUpdate(doc2, update1);
     };

     export const createTestDocWithContent = () => {
       const doc = new Y.Doc();
       const text = doc.getText('chat');
       text.insert(0, 'Hello, world!');
       const nodes = doc.getMap('nodes');
       nodes.set('node1', {
         id: 'node1',
         type: 'chat',
         position: { x: 100, y: 100 },
       });
       return doc;
     };
     ```

5. **Mock Supabase**:

   - Create a `mocks/supabase.ts` file to mock the Supabase client for unit and integration tests:

     ```typescript
     import { jest } from '@jest/globals';

     export const mockSupabase = {
       from: jest.fn().mockReturnThis(),
       select: jest.fn().mockReturnThis(),
       insert: jest.fn().mockReturnThis(),
       update: jest.fn().mockReturnThis(),
       delete: jest.fn().mockReturnThis(),
       eq: jest.fn().mockReturnThis(),
       in: jest.fn().mockReturnThis(),
       single: jest.fn(),
       data: [],
       error: null,
     };

     export const resetMocks = () => {
       Object.values(mockSupabase).forEach((fn) => {
         if (typeof fn === 'function' && 'mockClear' in fn) {
           fn.mockClear();
         }
       });
       mockSupabase.data = [];
       mockSupabase.error = null;
     };
     ```

6. **Mock LangChain**:

   - Create a `mocks/langchain.ts` file to mock LangChain responses:

     ```typescript
     import { jest } from '@jest/globals';

     export const mockOpenAI = {
       invoke: jest
         .fn()
         .mockResolvedValue({ text: 'This is a mock AI response' }),
       pipe: jest.fn(),
     };

     export const mockChat = jest.fn().mockImplementation(() => mockOpenAI);

     export const resetLangChainMocks = () => {
       mockOpenAI.invoke.mockClear();
       mockOpenAI.pipe.mockClear();
       mockChat.mockClear();
     };
     ```

7. **Set Up CI/CD**:
   - Update GitHub Actions workflows to run Jest and Playwright tests:

     ```yaml
     # .github/workflows/test.yml
     name: Tests
     on:
       push:
         branches: [main]
       pull_request:
         branches: [main]

     jobs:
       unit-tests:
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v3
           - uses: actions/setup-node@v3
             with:
               node-version: '18'
               cache: 'npm'
           - run: npm ci
           - run: npm run test:unit
           - run: npm run test:coverage

       e2e-tests:
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v3
           - uses: actions/setup-node@v3
             with:
               node-version: '18'
               cache: 'npm'
           - run: npm ci
           - name: Install Playwright Browsers
             run: npx playwright install --with-deps
           - run: npm run build
           - run: npm run start & npx wait-on http://localhost:3000
           - run: npm run test:e2e
     ```

---

## 4. Test Cases by Feature

Below are detailed test cases for each major feature of the RIFF app, aligned with the development roadmap. Each feature includes unit, integration, and E2E tests, with a focus on TDD principles (writing tests before implementation).

### 4.1 Phase 1: Project Setup, Supabase Deployment, Authentication, CI/CD

#### Unit Tests

- **Supabase Auth Service** (`server/services/AuthService.ts`):

  - Test `signUp`:
    - Should fail with invalid email format.
    - Should call Supabase Auth `signUp` with correct email and password.
    - Should return a user object on successful signup.
  - Test `login`:
    - Should fail with incorrect credentials.
    - Should return a JWT token on successful login.
  - Test `logout`:
    - Should call Supabase Auth `signOut` and return success.

- **Supabase Database Service** (`server/services/DatabaseService.ts`):
  - Test `createNode`:
    - Should insert a new node into the `chat_nodes` table.
    - Should return the created node's ID.
  - Test `getUserNodes`:
    - Should return a list of nodes for the authenticated user.
    - Should return an empty list if the user has no nodes.

#### Integration Tests

- **Auth API Endpoints** (`server/routes/authRoutes.ts`):
  - Test `POST /signup`:
    - Should return 400 for invalid email.
    - Should return 201 and a user object for valid signup.
  - Test `POST /login`:
    - Should return 401 for incorrect credentials.
    - Should return 200 and a JWT token for valid credentials.
  - Test `POST /logout`:
    - Should return 200 on successful logout.

#### E2E Tests

- **Authentication Flow** (`e2e/auth.spec.ts`):
  - Test signup:
    - Visit the signup page, enter valid credentials, and verify redirection to the canvas.
  - Test login:
    - Visit the login page, enter valid credentials, and verify redirection to the canvas.
  - Test logout:
    - Log in, click the logout button, and verify redirection to the login page.

---

### 4.2 Phase 2: React Flow Canvas, Chat Node UI, Basic Chat UI

#### Unit Tests

- **ChatNode Component** (`app/components/Chat/ChatNode.tsx`):

  - Should render the node title correctly.
  - Should display the node ID.
  - Should dynamically resize based on content (mock React Flow's `useNodesState`).
  - Should not render user presence indicators if no users are present.

- **ChatUI Component** (`app/components/Chat/ChatUI.tsx`):

  - Should render an empty message list when no messages exist.
  - Should display a message when added to the message list.
  - Should render placeholder buttons (e.g., "Attach," "Pull").

- **API Service** (`app/lib/api.ts`):
  - Test `createNode`:
    - Should call the backend API with the correct payload.
    - Should return the created node's ID.
  - Test `fetchNodeMessages`:
    - Should return a list of messages for the given node ID.
    - Should return an empty list if the node has no messages.

#### Integration Tests

- **Node Creation API** (`server/routes/nodeRoutes.ts`):

  - Test `POST /nodes`:
    - Should return 401 if the user is not authenticated.
    - Should return 201 and the node ID for an authenticated user.
    - Should insert the node into the `chat_nodes` table.

- **Node Messages API** (`server/routes/messageRoutes.ts`):
  - Test `GET /nodes/:id/messages`:
    - Should return 200 and a list of messages for the node.
    - Should return an empty list if the node has no messages.

#### E2E Tests

- **Canvas and Chat UI** (`e2e/canvas.spec.ts`):
  - Test node creation:
    - Click the floating menu button, create a new node, and verify it appears on the canvas.
  - Test node selection:
    - Click a node on the canvas, verify the chat UI updates to show the node's messages (empty initially).
  - Test message display:
    - Mock a node with messages, select the node, and verify the messages appear in the chat UI.

---

### 4.3 Phase 3: LangChain Integration, Model/Flavor Selection, AI Chat

#### Unit Tests

- **ChatService** (`server/services/ChatService.ts`):

  - Test `initializeChat`:
    - Should initialize LangChain with the selected model and Flavor.
    - Should throw an error if the API key is invalid.
  - Test `sendMessage`:
    - Should send a message to LangChain and return the AI response.
    - Should store the user message and AI response in the `chat_messages` table.
    - Should handle LangChain errors gracefully.

- **ChatUI Model/Flavor Selection** (`app/components/Chat/ChatUI.tsx`):
  - Should render model and Flavor dropdowns when creating a new node.
  - Should call the backend API with the selected model and Flavor when creating a node.

#### Integration Tests

- **Chat API** (`server/routes/chatRoutes.ts`):
  - Test `POST /nodes/:id/messages`:
    - Should return 401 if the user is not authenticated.
    - Should return 200 and the AI response for a valid message.
    - Should store the message and response in the `chat_messages` table.

#### E2E Tests

- **AI Chat Flow** (`e2e/chat.spec.ts`):
  - Test model/Flavor selection:
    - Create a new node, select a model and Flavor, and verify the node is created with the correct settings.
  - Test AI chat:
    - Create a node, send a message in the chat UI, and verify the AI responds (mock LangChain response).

---

### 4.4 Phase 4: Context Pulling, Incremental Updates, Summarization, Branching

#### Unit Tests

- **ContextService** (`server/services/ContextService.ts`):

  - Test `pullContext`:
    - Should fetch the full chat history from the origin node.
    - Should store the pulled context in the `pulled_context` table.
    - Should return the pulled messages.
  - Test `pullIncrementalUpdates`:
    - Should fetch only new messages since the last pull (based on `last_pulled_at`).
    - Should return an empty list if there are no new messages.
  - Test `summarizeContext`:
    - Should generate a summary using LangChain.
    - Should store the summary in the `chat_summaries` table.
  - Test `getRelevantMessages`:
    - Should generate embeddings for messages using `sentence-transformers`.
    - Should query `pgvector` for the top 5 relevant messages.

- **ChatNode Connections** (`app/components/Chat/ChatNode.tsx`):
  - Should render yellow rectangles for nodes from which context is pulled.
  - Should render blue rectangles for nodes that pulled context from this node.
  - Should display a red dot if the origin node has updates since the last pull.

#### Integration Tests

- **Context API** (`server/routes/contextRoutes.ts`):
  - Test `POST /nodes/:id/pull-context`:
    - Should return 200 and the pulled context for a valid request.
    - Should store the pull action in the `pulled_context` table.
  - Test `POST /nodes/:id/pull-incremental`:
    - Should return 200 and only new messages since the last pull.
  - Test `POST /nodes/:id/summarize`:
    - Should return 200 and a summary of the node's chat history.

#### E2E Tests

- **Context Management** (`e2e/context.spec.ts`):
  - Test context pulling:
    - Create two nodes, send messages in the first node, pull context into the second node, and verify the placeholder in the chat UI.
  - Test incremental updates:
    - Pull context, add new messages to the origin node, pull again, and verify only new messages are pulled.
  - Test summarization:
    - Pull a summary of a node's history and verify the summary placeholder in the chat UI.
  - Test branching:
    - Branch a node, send a message in the branched node, and verify the original node's history is unchanged.

---

### 4.5 Phase 5: Real-Time Collaboration with Yjs, User Presence, Write Permissions

#### Unit Tests

- **YjsService** (`app/lib/yjs/YjsProvider.ts`):

  - Test `initDocument`:
    - Should create a new Y.Doc with the correct initial structure.
    - Should initialize awareness with user metadata.
  - Test `applyUpdate`:
    - Should apply a Yjs update to the document.
    - Should broadcast the update to all connected clients.
  - Test `getUserPresence`:
    - Should return a list of users currently in the document.
    - Should include user metadata (avatar, name, cursor position).

- **AwarenessService** (`app/lib/yjs/useYjsAwareness.ts`):

  - Test `updateUserState`:
    - Should update the user's state in the awareness instance.
    - Should broadcast the state update to all connected clients.
  - Test `removeUser`:
    - Should remove the user from the awareness instance.
    - Should broadcast the removal to all connected clients.

- **ChatNode User Presence** (`app/components/Chat/ChatNode.tsx`):
  - Should render avatar indicators for users in the node.
  - Should update presence indicators when a user joins or leaves (mock Yjs awareness events).
  - Should show typing indicators based on awareness state.

#### Integration Tests

- **Yjs Document Synchronization** (`server/__tests__/yjs.test.ts`):
  - Test document updates:
    - Create two Yjs documents, apply changes to one, sync, verify both have same state.
  - Test conflict resolution:
    - Apply conflicting changes to two documents, sync, verify consistent state.
  - Test awareness updates:
    - Update awareness in one client, verify other clients receive the update.

#### E2E Tests

- **Collaboration Flow** (`e2e/collaboration.spec.ts`):
  - Test user presence:
    - Log in as two users, join the same node, and verify both see each other's presence indicators.
  - Test concurrent editing:
    - Log in as two users, have both make different changes, verify changes are merged correctly.
  - Test write permissions:
    - Verify appropriate UI indicators when multiple users are editing the same node.
  - Test offline collaboration:
    - Disconnect one user, make changes, reconnect, verify changes sync correctly.

---

### 4.6 Phase 6: File Attachments with Supabase Storage

#### Unit Tests

- **FileService** (`server/services/FileService.ts`):

  - Test `uploadFile`:
    - Should store the file in Supabase Storage.
    - Should save metadata in the `chat_attachments` table.
    - Should reject files with invalid types or sizes.
  - Test `processFileForAI`:
    - Should extract text from a PDF using `pdf-parse`.
    - Should return the file URL for images.

- **ChatNode Attachments** (`app/components/Chat/ChatNode.tsx`):
  - Should render orange rectangles for attached files.
  - Should update the UI when a new file is attached (mock WebSocket event).

#### Integration Tests

- **File API** (`server/routes/fileRoutes.ts`):
  - Test `POST /nodes/:id/files`:
    - Should return 400 for invalid file types.
    - Should return 201 and the file URL for a valid upload.
    - Should store the file in Supabase Storage and metadata in the database.

#### E2E Tests

- **File Attachments** (`e2e/files.spec.ts`):
  - Test file upload:
    - Create a node, upload a PDF, and verify the placeholder in the chat UI.
  - Test AI processing:
    - Upload a PDF, send a message, and verify the AI response includes the PDF content (mock LangChain response).
  - Test visual indicators:
    - Upload a file, verify the node UI shows an orange rectangle.

---

### 4.7 Phase 7: Frameworks, Templates, and Library Sidebar

#### Unit Tests

- **FrameworkService** (`server/services/FrameworkService.ts`):

  - Test `applyFramework`:
    - Should initialize a chat with the framework's prompts.
    - Should store the user's answers in the `chat_messages` table.
    - Should generate a summary at the end of the interview.
  - Test `editFramework`:
    - Should update the framework in the `frameworks` table.

- **TemplateService** (`server/services/TemplateService.ts`):

  - Test `applyTemplate`:
    - Should pull context from specified nodes.
    - Should apply the template prompt using LangChain.
    - Should store the output in the `chat_messages` table.

- **LibrarySidebar Component** (`app/components/LibrarySidebar.tsx`):
  - Should render frameworks and templates in separate sections.
  - Should display starred items at the top.
  - Should allow editing a framework/template and call the backend API.

#### Integration Tests

- **Framework API** (`server/routes/frameworkRoutes.ts`):
  - Test `POST /frameworks/apply`:
    - Should return 200 and the initial framework prompt.
    - Should store the user's answers in the database.
  - Test `PUT /frameworks/:id`:
    - Should return 200 and update the framework.

#### E2E Tests

- **Frameworks and Templates** (`e2e/frameworks.spec.ts`):
  - Test framework application:
    - Create a node with a framework, answer the interview questions, and verify the summary in the chat UI.
  - Test template application:
    - Create a node, apply a template (e.g., PRD), and verify the output in the chat UI.
  - Test library sidebar:
    - Open the sidebar, star a framework, and verify it appears at the top.
    - Edit a template, save changes, and verify the updated template is applied.

---

### 4.8 Phase 8: Security, Performance Optimization, UI/UX Refinement

#### Unit Tests

- **Security Middleware** (`server/middleware/security.ts`):

  - Test `sanitizeInput`:
    - Should remove malicious scripts from user input.
    - Should allow safe HTML (e.g., bold text).
  - Test `rateLimit`:
    - Should allow requests under the limit.
    - Should return 429 if the limit is exceeded.

- **Performance Utils** (`server/utils/performance.ts`):
  - Test `lazyLoadMessages`:
    - Should return only the first 20 messages for a node.
    - Should return the next 20 messages on the second call.

#### Integration Tests

- **Security Tests** (`server/__tests__/security.test.ts`):
  - Test XSS prevention:
    - Send a message with a script tag, verify the script is removed in the response.
  - Test rate limiting:
    - Send 100 requests in a minute, verify the 101st request returns 429.

#### E2E Tests

- **UI/UX Refinement** (`e2e/uiux.spec.ts`):
  - Test node transitions:
    - Switch between nodes, verify the chat UI updates smoothly.
  - Test loading indicators:
    - Send a message, verify a loading indicator appears while the AI responds.
  - Test performance:
    - Create 20 nodes, verify the canvas loads without significant delay (mock lazy loading).

---

### 4.9 Phase 9: Testing and Documentation

This phase focuses on expanding test coverage and documenting the testing process. Since testing is already integrated into the TDD workflow, this phase will focus on edge cases and documentation.

#### Additional Test Cases

- **Edge Cases**:
  - Test large chat histories (e.g., 1,000 messages):
    - Verify summarization and embedding-based retrieval work correctly.
  - Test concurrent users:
    - Simulate 5 users joining the same node, verify write permissions and presence updates.
  - Test invalid inputs:
    - Send malformed messages, verify the backend sanitizes them.

#### Documentation

- Document the testing setup in `TESTING.md`:
  - Instructions for running unit, integration, and E2E tests.
  - Details on mocking Supabase and LangChain.
  - Guidelines for writing new tests in the TDD workflow.

---

### 4.10 Phase 10: Deployment, Monitoring, and Finalization

#### E2E Tests

- **Production Environment** (`e2e/production.spec.ts`):
  - Test deployment:
    - Visit the production URL, log in, create a node, and send a message.
  - Test monitoring:
    - Verify Grafana dashboards show API response times and WebSocket event rates (manual check).

#### Monitoring Tests

- **Prometheus Metrics** (`server/__tests__/monitoring.test.ts`):
  - Test metric collection:
    - Send a request, verify the `http_request_duration_seconds` metric is recorded.
  - Test WebSocket metrics:
    - Emit a WebSocket event, verify the `websocket_events_total` metric is recorded.

---

## 5. Best Practices for TDD

1. **Write Tests First**:

   - Always write a failing test before implementing the feature.
   - Use the test to define the expected behavior and edge cases.

2. **Keep Tests Focused**:

   - Each test should verify one specific behavior.
   - Avoid testing multiple features in a single test case.

3. **Mock Dependencies**:

   - Mock external services (e.g., Supabase, LangChain) to isolate the unit under test.
   - Use realistic mock data to simulate real-world scenarios.

4. **Test Edge Cases**:

   - Include tests for invalid inputs, large datasets, and concurrent users.
   - Ensure error handling is robust and user-friendly.

5. **Run Tests Frequently**:

   - Run tests after every change to catch regressions early.
   - Use `jest --watch` for unit tests and `cypress open` for E2E tests during development.

6. **Integrate with CI/CD**:
   - Ensure all tests pass in the CI pipeline before merging or deploying.
   - Use GitHub Actions to run tests on pull requests and deployments.

---

## 6. Example TDD Workflow for a Feature

### Feature: Yjs Integration (Phase 5)

#### Step 1: Write a Failing Test (Red)

```typescript
// app/lib/yjs/__tests__/YjsProvider.test.ts
import { YjsProvider } from '../YjsProvider';
import * as Y from 'yjs';
import { mock } from 'ts-mockito';

describe('YjsProvider', () => {
  let yjsProvider: YjsProvider;
  let mockWebsocketProvider: any;

  beforeEach(() => {
    mockWebsocketProvider = mock();
    yjsProvider = new YjsProvider(mockWebsocketProvider);
  });

  it('should create a new Y.Doc with the correct structure', () => {
    const documentId = 'doc_1';
    const userId = 'user_1';
    const userName = 'Test User';

    const doc = yjsProvider.initDocument(documentId, userId, userName);

    // Verify document structure
    expect(doc).toBeInstanceOf(Y.Doc);
    expect(doc.getText('chat')).toBeInstanceOf(Y.Text);
    expect(doc.getMap('nodes')).toBeInstanceOf(Y.Map);
    expect(doc.getMap('edges')).toBeInstanceOf(Y.Map);

    // Verify awareness initialization
    const awareness = yjsProvider.getAwareness(documentId);
    expect(awareness.getLocalState()).toEqual({
      user: { id: userId, name: userName },
      cursor: null,
    });
  });
});
```

#### Step 2: Write Minimal Code to Pass (Green)

```typescript
// app/lib/yjs/YjsProvider.ts
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

export class YjsProvider {
  private docs = new Map<string, Y.Doc>();
  private awareness = new Map<string, Awareness>();

  constructor(private websocketProvider: any) {}

  initDocument(documentId: string, userId: string, userName: string): Y.Doc {
    const doc = new Y.Doc();

    // Initialize document structure
    doc.getText('chat'); // Create text type for chat messages
    doc.getMap('nodes'); // Create map for canvas nodes
    doc.getMap('edges'); // Create map for canvas edges

    // Set up awareness
    const awareness = new Awareness(doc);
    awareness.setLocalState({
      user: { id: userId, name: userName },
      cursor: null,
    });

    // Store references
    this.docs.set(documentId, doc);
    this.awareness.set(documentId, awareness);

    return doc;
  }

  getAwareness(documentId: string): Awareness {
    return this.awareness.get(documentId);
  }
}
```

#### Step 3: Refactor

- Add error handling, input validation, and logging.
- Set up proper cleanup of documents and awareness instances.
- Run the test again to ensure it still passes.

#### Step 4: Add More Tests

- Add tests for document synchronization, updates, and awareness changes.
- Repeat the TDD cycle for each new test.

## 7. Testing For Correctness Not Conformance

A critical aspect of effective TDD is ensuring that tests validate what the code _should_ do, rather than merely confirming what the code currently does. This distinction is essential for identifying and fixing bugs rather than cementing them into the codebase.

### 7.1 Identifying the Source of Truth

Before writing tests, identify the authoritative source of truth for the expected behavior:

1. **Product Requirements**: Documented user stories, acceptance criteria, and functional specifications
2. **Design Documents**: Architecture diagrams, data flow descriptions, and component interfaces
3. **API Specifications**: OpenAPI/Swagger documentation or similar formal API definitions
4. **UI/UX Designs**: Wireframes, mockups, and user interaction flows
5. **Business Rules**: Domain-specific logic that governs application behavior

These sources should be consulted before writing tests to ensure that tests validate the intended behavior, not just the existing implementation.

### 7.2 Writing Tests That Catch Bugs

To write tests that can effectively catch bugs:

1. **Start with Behavior, Not Code**: Begin by defining the expected behavior based on requirements, not by examining the current implementation.

2. **Test Edge Cases First**: Focus on boundary conditions, unusual inputs, and exceptional circumstances where bugs are most likely to hide.

3. **Separate Unit Tests from Implementation Details**: Test the public API of components, not their internal mechanisms, to allow for implementation changes.

4. **Document Test Rationale**: Include comments explaining why a test expects a particular result, referencing requirements or specifications.

5. **Test Failure Modes**: Explicitly test how components should behave when things go wrong (e.g., network errors, invalid inputs).

### 7.3 Dealing with Discovered Bugs

When a test reveals a discrepancy between actual and expected behavior:

1. **Confirm the Expected Behavior**: Verify that your understanding of the requirements is correct by consulting documentation or stakeholders.

2. **Write a Failing Test**: Create a test that fails because of the bug, documenting the expected correct behavior.

3. **Fix the Implementation**: Modify the code to pass the test, addressing the bug.

4. **Add Regression Test**: Ensure the bug doesn't reappear by keeping the test in the suite.

### 7.4 Example: Testing Chat Node Behavior

**Incorrect Approach (Testing Current Behavior):**

```typescript
// This test simply confirms what the code currently does
it('filters out empty messages', () => {
  const service = new ChatService();
  const result = service.processMessage('');
  expect(result).toBeNull(); // Just testing what happens now
});
```

**Correct Approach (Testing Required Behavior):**

```typescript
// This test validates against requirements
it('should reject empty messages with a descriptive error message', () => {
  // Requirement: PR-103 specifies that empty messages should return a user-friendly error
  const service = new ChatService();
  const result = service.processMessage('');
  expect(result).toEqual({
    success: false,
    error: 'Message cannot be empty',
    errorCode: 'EMPTY_MESSAGE',
  });
});
```

### 7.5 Regularly Review Test Coverage Against Requirements

Schedule regular reviews to ensure that:

1. All requirements have corresponding tests
2. Tests accurately reflect current requirements (not outdated specifications)
3. Test failures are treated as potential bugs, not test problems
4. Changes to requirements result in updated tests before code changes

By focusing on testing against requirements rather than current implementation, the test suite becomes a tool for improving quality rather than preserving the status quo.

## 8. Integrating TDD with Current Workflow

This section provides practical guidance for integrating Test-Driven Development into the existing Riff development workflow, aligning with the implementation plan outlined in the testing strategy documentation.

### 8.1 Aligning with the Testing Implementation Plan

The TDD approach described in this document should be implemented in coordination with the phased testing strategy outlined in `testing-implementation-plan.md`. Specifically:

1. **Phase Alignment**: Ensure that the TDD work matches the current phase of the testing implementation plan.
2. **Progress Tracking**: Update the `implementation-progress.md` document when completing TDD cycles for specific features.
3. **Resource Allocation**: Allocate development resources according to the testing implementation plan, with frontend and backend developers focusing on their respective areas.

### 8.2 Workflow Integration Steps

To integrate TDD into your current workflow:

1. **Start with Current Implementation Phase**:

   - Identify which phase of the testing implementation plan is currently active.
   - Focus TDD efforts on the features and components in that phase.

2. **Review Existing Code**:

   - For areas with existing code but no tests, write tests based on requirements (not just current behavior).
   - Use these tests to identify potential bugs or inconsistencies with requirements.

3. **Apply TDD for New Features**:

   - For new features, follow the pure TDD approach: test first, implementation second.
   - Reference this document for specific test cases relevant to the feature being developed.

4. **Document Testing Decisions**:
   - When making testing decisions that deviate from this guide, document the rationale in comments or pull request descriptions.
   - Update this guide if necessary to reflect evolving best practices.

### 8.3 Working with Yjs and Real-Time Collaboration

Since the codebase has migrated to Yjs for real-time collaboration, apply these TDD principles with special consideration:

1. **Yjs Document Testing**:

   - Test the structure of Yjs documents (e.g., Y.Text, Y.Map).
   - Test local changes to Yjs documents before testing synchronization.
   - Test conflict resolution with simulated concurrent changes.

2. **Awareness Testing**:

   - Test awareness updates for user presence, cursor position, etc.
   - Test awareness state synchronization across clients.

3. **Offline/Reconnection Testing**:
   - Test document changes while offline.
   - Test synchronization after reconnection.

### 8.4 Integrating with Pull Request Process

Enforce TDD principles through the pull request process:

1. **Require Tests in PRs**:

   - Every pull request should include tests for new code.
   - Tests should be comprehensive and based on requirements.

2. **Test Review**:

   - Code reviewers should verify that tests validate requirements, not just implementation.
   - Code reviewers should ensure tests cover edge cases and error conditions.

3. **CI Integration**:
   - Configure CI to run tests automatically on pull requests.
   - Require all tests to pass before merging.

### 8.5 Example: Adding a New Feature with TDD

**Scenario**: Adding a feature to export canvas data to a JSON file.

**TDD Workflow**:

1. **Identify Requirements**:

   - Review the feature requirements in product documentation.
   - Identify acceptance criteria (e.g., format of the JSON, included data).

2. **Write Tests First**:

   ```typescript
   describe('Canvas Export Service', () => {
     it('should export nodes with their content and positions', () => {
       // Arrange: Set up a canvas with nodes
       const canvas = createTestCanvas();
       const exportService = new CanvasExportService();

       // Act: Export the canvas
       const result = exportService.exportToJson(canvas);

       // Assert: Verify the exported JSON contains expected data
       expect(result).toHaveProperty('nodes');
       expect(result.nodes).toBeInstanceOf(Array);
       expect(result.nodes[0]).toHaveProperty('id');
       expect(result.nodes[0]).toHaveProperty('position');
       expect(result.nodes[0]).toHaveProperty('content');
     });

     it('should include edge connections between nodes', () => {
       // Similar test structure
     });

     it('should handle empty canvas', () => {
       // Test edge case
     });
   });
   ```

3. **Implement the Feature**:

   - Write the implementation to make the tests pass.
   - Refactor as needed while keeping tests passing.

4. **Document in Implementation Progress**:
   - Update `implementation-progress.md` to indicate that the export feature has been developed using TDD.

By following this approach, TDD can be effectively integrated into the existing workflow while ensuring alignment with the overall testing strategy.

## 9. Enhancing the Current Testing Strategy

This TDD approach complements and enhances the current testing strategy outlined in `testing-strategy-overview.md` by providing specific implementation details and workflows. Here's how this document integrates with and extends the existing strategy:

### 9.1 Alignment with Testing Pyramid

The current testing strategy overview defines a balanced pyramid approach:

- **Unit Tests (60%)**
- **Integration Tests (25%)**
- **End-to-End Tests (10%)**
- **Manual/Exploratory Testing (5%)**

This TDD document provides concrete implementation details for each layer:

1. **Unit Tests**: Detailed examples of component, service, and utility tests with specific assertions
2. **Integration Tests**: Practical examples of API endpoint testing and cross-component interactions
3. **End-to-End Tests**: Specific Playwright-based user flows that validate complete features

### 9.2 Addressing Key Testing Areas

The testing strategy overview identifies five key testing areas:

1. Frontend Components
2. Backend Services
3. Yjs Integration
4. Collaborative Features
5. Data Persistence

This TDD document provides detailed test cases for each area, particularly strengthening:

- **Yjs Integration**: Detailed testing guidance for Yjs documents, awareness, and synchronization
- **Collaborative Features**: Specific tests for real-time collaboration, conflict resolution, and offline support

### 9.3 Enhancing Best Practices

The testing strategy overview lists ten best practices, which this TDD document expands upon with:

- **Concrete examples** of test implementations following the AAA pattern
- **Implementation guidance** for isolating test dependencies through mocking
- **Practical approaches** to testing asynchronous code and edge cases

### 9.4 Strengthening Test Quality

This TDD document introduces additional principles to improve test quality:

1. **Testing for correctness, not conformance**: Ensuring tests validate requirements rather than existing behavior
2. **Source of truth identification**: Using product requirements to define expected behavior
3. **Bug discovery workflow**: Identifying and fixing bugs through test-first approach

### 9.5 Integration Into Workflow

The primary enhancement this TDD approach adds to the testing strategy is a concrete workflow for:

1. Writing tests before implementation for new features
2. Reviewing and testing existing code against requirements
3. Integrating testing into the pull request and code review process
4. Aligning with the phased implementation plan

### 9.6 Recommendations for Strategy Enhancement

Based on this TDD approach, the following enhancements are recommended for the testing strategy overview:

1. **Add a TDD section**: Incorporate test-first principles into the best practices
2. **Include example tests**: Add references to example implementations for each testing level
3. **Strengthen the correctness principle**: Emphasize testing against requirements over implementation
4. **Update metrics**: Add metrics for test-first coverage (percentage of features implemented with TDD)
5. **Include workflow details**: Reference this workflow document for practical implementation steps

By combining the strategic overview with this detailed TDD implementation approach, the testing strategy becomes more actionable, practical, and effective at ensuring the quality and correctness of the Riff application.
