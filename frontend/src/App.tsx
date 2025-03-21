import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import CanvasPage from './pages/CanvasPage';
import './styles/auth.css';
import './styles/app.css';

const AppContent: React.FC = () => {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <div className="auth-container">
        <h1>Welcome to RIFF</h1>
        <div className="auth-forms">
          <Login />
          <Signup />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Canvas (61.8%) - Golden Ratio */}
      <div style={{ width: '61.8%', height: '100%' }}>
        <CanvasPage />
      </div>

      {/* Chat UI (38.2%) - Placeholder for now */}
      <div
        style={{
          width: '38.2%',
          height: '100%',
          background: '#f0f0f0',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Chat UI Placeholder</h2>
          <button onClick={signOut}>Logout</button>
        </div>
        <p>This area will contain the chat interface in the next step.</p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
