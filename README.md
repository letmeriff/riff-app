# RIFF App

RIFF is a collaborative real-time flow-based interface for AI interactions. This application allows users to create, share, and interact with AI-powered workflows in a visual, node-based environment.

## Project Structure

The project is organized as a monorepo with two main packages:

- `frontend/`: React application with React Flow for the visual interface
- `backend/`: Node.js/Express server with Socket.IO for real-time communication

## Prerequisites

- Node.js (v16 or later)
- npm (v7 or later)
- A Supabase account and project

## Environment Variables

### Frontend (.env)

```
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
REACT_APP_BACKEND_URL=http://localhost:3001
```

### Backend (.env)

```
PORT=3001
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-service-key
```

## Getting Started

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd riff-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development servers:

   In one terminal:

   ```bash
   cd frontend
   npm start
   ```

   In another terminal:

   ```bash
   cd backend
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Development

- Frontend runs on port 3000
- Backend runs on port 3001
- Uses TypeScript for type safety
- ESLint and Prettier for code formatting
- Workspace management with npm workspaces

## License

MIT

## CI/CD Setup

This project uses GitHub Actions for continuous integration and deployment. The workflow is set up as follows:

### Staging Environment

The staging environment is automatically updated when changes are pushed to the `main` branch. The workflow:

1. Runs linting and tests
2. Deploys the frontend to Vercel (preview environment)
3. Deploys the backend to Render (staging service)
4. Posts deployment status as a comment on PRs

Trigger: Push to `main` branch or pull request

### Production Environment

The production environment is updated when a new release is published. The workflow:

1. Deploys the frontend to Vercel (production)
2. Deploys the backend to Render (production service)
3. Updates the GitHub release with deployment information

Trigger: Publishing a new release

### Required Secrets

The following secrets need to be configured in GitHub:

- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID
- `RENDER_API_KEY`: Render API key
- `RENDER_SERVICE_ID`: Render service ID (staging)
- `RENDER_PROD_SERVICE_ID`: Render service ID (production)

### Development Workflow

1. Create a feature branch from `main`
2. Make your changes and commit them
3. Create a pull request to `main`
4. Wait for CI checks to pass
5. Get code review and approval
6. Merge to `main` (deploys to staging)
7. Create and publish a release (deploys to production)

### Monitoring Deployments

- Staging deployments can be monitored in PR comments
- Production deployments are tracked in GitHub Releases
- Both environments can be monitored in Vercel and Render dashboards

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development servers:
   ```bash
   npm start
   ```

## Testing

Riff implements a comprehensive testing strategy that covers all aspects of the application, from unit tests to end-to-end tests.

### Running Tests

Run all tests:

```bash
npm test
```

Run frontend tests:

```bash
npm run test:frontend
```

Run backend tests:

```bash
npm run test:backend
```

Run end-to-end tests:

```bash
npm run test:e2e
```

Run tests with coverage:

```bash
npm run coverage
```

### Testing Structure

Our testing strategy follows a layered approach:

1. **Unit Tests**: Test individual functions and components in isolation
2. **Integration Tests**: Test interactions between components
3. **End-to-End Tests**: Test complete user flows

### Test Organization

- `__tests__/`: Contains test files for corresponding components and functions
- `test-utils/`: Utility functions, mocks, and fixtures for testing
- `e2e/`: End-to-end tests using Playwright

### Technologies

- **Jest**: Test runner and assertion library
- **React Testing Library**: Testing React components
- **Supertest**: Testing REST APIs
- **Playwright**: End-to-end testing

### Test Documentation

For more detailed information about our testing approach, see the testing documentation:

- [Testing Strategy Overview](./dev-docs/testing-strategy/riff-testing-strategy-overview.md)
- [Testing Patterns and Conventions](./dev-docs/testing-strategy/test-patterns.md)
- [Test Examples](./dev-docs/testing-strategy/test-examples.md)

### Writing Tests

When writing tests, follow these guidelines:

1. Follow the Arrange-Act-Assert (AAA) pattern
2. Keep tests focused and isolated
3. Use descriptive test names
4. Mock external dependencies appropriately
5. Use the testing utilities and helpers provided

## Code Quality

- Linting: `npm run lint`
- Formatting: `npm run format`
- Format check: `npm run format:check`

## Test Staging Deployment

This change is to test our staging deployment workflow.

## Features

- User authentication with Supabase
- Real-time collaboration
- Modern React frontend
- Express.js backend
- CI/CD with GitHub Actions
- Automated deployments to staging and production

## Development

To run the project locally:

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```
3. Set up environment variables (see `.env.example` files)
4. Start the development servers:
   ```bash
   npm run dev
   ```

## Testing

Run tests with:

```bash
npm test
```

## Deployment

- Staging: Automatically deployed on pull requests
- Production: Automatically deployed on releases

## Canvas System

The Canvas is the core component of the application where users interact with nodes and create connections.

### Refactored Implementation

The Canvas system has been refactored to improve performance, maintainability, and error handling. Key improvements include:

#### Architecture and Design

- **Component Decomposition**: Split into smaller, focused components with clear responsibilities
- **Custom Hooks**: Extracted logic into reusable, testable hooks
- **Container/Presenter Pattern**: Separation of data management and rendering concerns
- **Type Safety**: Comprehensive TypeScript interfaces for all components and hooks

#### Performance Enhancements

- **Memoization**: Extensive use of React.memo, useMemo, and useCallback to prevent unnecessary renders
- **Virtualization**: Only render nodes visible in the current viewport
- **Optimized Yjs Updates**: Batched updates and debounced/throttled position changes
- **Performance Monitoring**: Real-time metrics tracking with PerformanceMonitor component

#### Error Handling

- **Error Boundaries**: Graceful degradation with CanvasErrorBoundary
- **Detailed Error Reporting**: Configurable error reporting with feature flags
- **Recovery Mechanisms**: Ability to reset and retry after errors
- **Comprehensive Testing**: Integration and unit tests for error scenarios

#### Feature Flags

The refactored Canvas implementation can be enabled/disabled via feature flags in `.env.development`:

```
# Enable the refactored Canvas component
REACT_APP_USE_REFACTORED_CANVAS=true

# Enable detailed error reporting
REACT_APP_ENABLE_ERROR_REPORTING=true

# Enable performance monitoring
REACT_APP_ENABLE_PERFORMANCE_MONITORING=true

# Enable virtualization for large canvas
REACT_APP_ENABLE_VIRTUALIZATION=true
```

### Development

#### Canvas Component Hierarchy

- `CanvasPage`: Container component orchestrating all hooks and subcomponents
- `Canvas`: ReactFlow wrapper with standardized interface
- `CanvasToolbar`: Controls for zoom, layout, and settings
- `NodeControls`: Controls for node creation and deletion
- `CollaborationOverlay`: Shows collaboration status and connected users
- `PerformanceMonitor`: Displays real-time performance metrics
- `CanvasErrorBoundary`: Provides graceful error handling

#### Canvas Hooks

- `useCanvasNodes`: Manages node state, creation, update, and deletion
- `useCanvasEdges`: Manages edge state and connections
- `useYjsIntegration`: Handles real-time collaboration with Yjs
- `useCanvasUI`: Manages UI state like selection and viewport

#### Testing

The Canvas components have extensive unit and integration tests. To run the tests:

```bash
# Run all Canvas tests
npm test -- Canvas

# Run specific component tests
npm test -- Canvas/components/CanvasErrorBoundary
```
