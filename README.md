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