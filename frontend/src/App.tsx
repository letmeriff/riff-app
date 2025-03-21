import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import CanvasPage from './pages/CanvasPage';
import ChatUI from './components/ChatUI';
import './styles/auth.css';
import './styles/app.css';

const AppContent: React.FC = () => {
  const { user, signOut } = useAuth();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeTitle, setSelectedNodeTitle] = useState<string | null>(null);

  const handleNodeSelect = (nodeId: string | null, nodeTitle: string | null) => {
    setSelectedNodeId(nodeId);
    setSelectedNodeTitle(nodeTitle);
  };

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
        <CanvasPage onNodeSelect={handleNodeSelect} />
      </div>

      {/* Chat UI (38.2%) */}
      <div style={{ width: '38.2%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          <ChatUI nodeId={selectedNodeId} nodeTitle={selectedNodeTitle} />
        </div>
        <div style={{ padding: '10px', background: '#fff', borderTop: '1px solid #ddd' }}>
          <button onClick={signOut} style={{ padding: '5px 10px' }}>Logout</button>
        </div>
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
