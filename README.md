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