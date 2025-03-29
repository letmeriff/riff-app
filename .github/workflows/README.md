# Riff App CI/CD Workflow

This directory contains the GitHub Actions workflows that implement the CI/CD pipeline for the Riff application.

## Overview

The Riff application uses a comprehensive CI/CD pipeline to ensure high-quality releases while supporting the collaborative and AI-driven features of the application.

## Branch Strategy

The repository uses the following branch strategy:

- **test-staging-deployment**: Development branch where active development happens. Pushes trigger deployments to the staging environment.
- **main**: Production branch. Changes should only be merged to this branch when they are ready for production. Pushes trigger deployments to the production environment.

## Workflows

### 1. CI/CD Pipeline (`ci-cd.yml`)

This is the main workflow that handles:
- Code quality checks (linting and formatting)
- Unit and integration testing
- Building the application
- Deployment to different environments
- Post-deployment monitoring and audits

The workflow supports both automated deployments based on git events and manual deployments through workflow dispatch.

### 2. CI (`ci.yml`)

Legacy CI workflow that handles:
- Code quality checks
- Testing
- Deployment to staging environment

### 3. Production Deployment (`deploy-production.yml`)

Legacy workflow for production deployment triggered by release events.

## Environment Strategy

The CI/CD pipeline supports multiple environments:

- **Development**: For feature branches and pull requests
- **Staging**: For changes pushed to the `test-staging-deployment` branch
- **Production**: For changes pushed to the `main` branch

## Testing Strategy

The pipeline implements the comprehensive testing strategy outlined in the development documentation:

- **Unit Tests**: For individual components and functions
- **Integration Tests**: For interactions between components
- **Yjs Integration Tests**: For collaborative features
- **Post-deployment Tests**: For validating the deployed application

## Deployment Targets

- **Frontend**: Deployed to Vercel
- **Backend**: Deployed to Render
- **Database**: Supabase PostgreSQL (migrations applied manually via SQL Editor)

## CI/CD Best Practices

This implementation follows these best practices:

1. **Automation**: The entire pipeline is automated from code commit to deployment
2. **Testing**: Comprehensive testing at multiple levels
3. **Environment Isolation**: Separate environments for different stages
4. **Artifact Management**: Build artifacts are stored for later use
5. **Notifications**: Deployment status notifications with reminders for manual steps
6. **Validation**: Post-deployment checks for quality assurance
7. **Security**: Secrets management through GitHub environment variables
8. **Performance**: Optimized workflow with caching and parallel jobs
9. **Monitoring**: Post-deployment monitoring for early issue detection
10. **Documentation**: This README and inline code comments

## Setting Up Secrets

The following secrets need to be configured in your GitHub repository:

- `SUPABASE_URL`: URL of your Supabase instance
- `SUPABASE_ANON_KEY`: Anonymous API key for Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for privileged Supabase operations
- `VERCEL_TOKEN`: Vercel API token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID
- `RENDER_API_KEY`: Render API key
- `RENDER_SERVICE_ID`: ID of the staging service in Render
- `RENDER_PROD_SERVICE_ID`: ID of the production service in Render

## Database Migrations

Database migrations need to be applied manually using the Supabase SQL Editor. The workflow will:

1. Display a reminder during deployment that migrations need to be applied
2. Include a reminder in the deployment notification
3. List SQL files that need to be applied

This manual approach ensures you have full control over database schema changes.

## Workflow Usage

### Automated CI/CD

The workflow runs automatically on:
- Push to `main` branch (deploys to production)
- Push to `test-staging-deployment` branch (deploys to staging)
- Pull requests to either branch (runs tests but doesn't deploy)

### Manual Deployment

You can also trigger the workflow manually:

1. Go to the Actions tab in your GitHub repository
2. Select the "Riff App CI/CD Pipeline" workflow
3. Click "Run workflow"
4. Select the target environment (staging or production)
5. Click "Run workflow"

## Monitoring Deployments

After a deployment, the workflow creates:
- A comment on the related pull request (if applicable)
- Audit reports for accessibility and performance
- Deployment links for easy access to the deployed application

## GitHub Action Workflows

This directory contains the GitHub Action workflows for the Riff application:

- `ci.yml`: CI pipeline for testing and deploying to the staging environment
- `ci-cd.yml`: Comprehensive CI/CD pipeline with multi-environment support
- `deploy-production.yml`: Production deployment triggered by releases
- `tests.yml`: Dedicated testing workflow with detailed coverage reporting

### Testing Workflow

The `tests.yml` workflow is a dedicated pipeline for running tests and generating coverage reports:

- **Unit Tests**: Run unit tests for both frontend and backend with coverage reporting
- **Integration Tests**: Run integration tests with a Postgres database
- **End-to-End Tests**: Run Playwright tests against the full application
- **Coverage Report**: Generate combined coverage reports and check against thresholds

The testing workflow can be triggered manually via the GitHub Actions UI or automatically on push/PR to main and develop branches 