import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Login from './components/Login';
import Signup from './components/Signup';
import CanvasPage from './pages/CanvasPage';
import ChatUI from './components/ChatUI';
import { supabase } from './services/supabase';
import './styles/auth.css';
import './styles/app.css';

const AppContent: React.FC = () => {
  const { user, session, signOut } = useAuth();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeTitle, setSelectedNodeTitle] = useState<string | null>(null);

  const handleNodeSelect = (nodeId: string | null, nodeTitle: string | null) => {
    setSelectedNodeId(nodeId);
    setSelectedNodeTitle(nodeTitle);
  };

  // Listen for custom event when a node is created via branching
  useEffect(() => {
    const handleSelectNodeEvent = (event: CustomEvent) => {
      const { nodeId } = event.detail;
      console.log('Custom event: select-node received with nodeId:', nodeId);
      
      setSelectedNodeId(nodeId);
      
      // Fetch the node title from Supabase
      const fetchNodeTitle = async () => {
        try {
          const { data, error } = await supabase
            .from('chat_nodes')
            .select('title')
            .eq('node_id', parseInt(nodeId))
            .single();
          
          if (error) {
            console.error('Error fetching node title:', error);
            return;
          }
          
          setSelectedNodeTitle(data.title);
        } catch (error) {
          console.error('Error in fetchNodeTitle:', error);
        }
      };
      
      fetchNodeTitle();
    };

    // Add event listener
    window.addEventListener('select-node', handleSelectNodeEvent as EventListener);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('select-node', handleSelectNodeEvent as EventListener);
    };
  }, []);

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
    <SocketProvider token={session?.access_token || null}>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        {/* Canvas (61.8%) - Golden Ratio */}
        <div style={{ width: '61.8%', height: '100%' }}>
          <CanvasPage onNodeSelect={handleNodeSelect} />
        </div>

        {/* Chat UI (38.2%) */}
        <div style={{ width: '38.2%', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <ChatUI 
              nodeId={selectedNodeId} 
              nodeTitle={selectedNodeTitle} 
              userId={user.id} 
            />
          </div>
          <div style={{ padding: '10px', background: '#fff', borderTop: '1px solid #ddd' }}>
            <button onClick={signOut} style={{ padding: '5px 10px' }}>Logout</button>
          </div>
        </div>
      </div>
    </SocketProvider>
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
