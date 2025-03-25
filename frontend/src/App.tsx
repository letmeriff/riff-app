import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { CRDTProvider } from './contexts/CRDTContext';
import Login from './components/Login';
import Signup from './components/Signup';
import CanvasPage from './pages/CanvasPage';
import ChatUI from './components/ChatUI';
import SettingsModal from './components/SettingsModal';
import { supabase } from './services/supabase';
import './styles/auth.css';
import './styles/app.css';
import ConnectionStatus from './components/ConnectionStatus';

const AppContent: React.FC = () => {
  const { user, session, signOut } = useAuth();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeTitle, setSelectedNodeTitle] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasCheckedApiKeys, setHasCheckedApiKeys] = useState(false);

  const handleNodeSelect = (nodeId: string | null, nodeTitle: string | null) => {
    setSelectedNodeId(nodeId);
    setSelectedNodeTitle(nodeTitle);
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
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

  // Listen for node updates to keep title in sync
  useEffect(() => {
    if (!selectedNodeId) return;
    
    const channel = supabase
      .channel('chat_nodes_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_nodes',
          filter: `node_id=eq.${selectedNodeId}`,
        },
        (payload) => {
          if (payload.new && payload.new.title) {
            setSelectedNodeTitle(payload.new.title);
          }
        }
      )
      .subscribe();
    
    return () => {
      channel.unsubscribe();
    };
  }, [selectedNodeId]);

  // Check if user has any API keys on login
  useEffect(() => {
    if (!user || hasCheckedApiKeys) return;

    const checkApiKeys = async () => {
      try {
        // Get the current session token using Supabase's current method
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) return;

        const response = await fetch('http://localhost:3001/api/models', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch models');
          return;
        }

        const models = await response.json();
        if (models.length === 0) {
          // Open the settings modal if no API keys are found
          setIsSettingsOpen(true);
        }
        setHasCheckedApiKeys(true);
      } catch (error) {
        console.error('Error checking API keys:', error);
      }
    };

    checkApiKeys();
  }, [user, hasCheckedApiKeys]);

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
      <CRDTProvider>
        <div style={{ 
          display: 'flex', 
          height: '100vh', 
          width: '100vw', 
          overflow: 'hidden',
          position: 'fixed', 
          top: 0,
          left: 0
        }}>
          {/* Canvas (61.8%) - Golden Ratio */}
          <div style={{ width: '61.8%', height: '100%', overflow: 'hidden' }}>
            <CanvasPage onNodeSelect={handleNodeSelect} onOpenSettings={handleOpenSettings} />
          </div>

          {/* Chat UI (38.2%) */}
          <div style={{ width: '38.2%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ChatUI 
                nodeId={selectedNodeId} 
                nodeTitle={selectedNodeTitle} 
                userId={user.id} 
              />
            </div>
            <div style={{ 
              padding: '10px', 
              background: '#fff', 
              borderTop: '1px solid #ddd', 
              display: 'flex', 
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <ConnectionStatus />
              <div>
                <button 
                  onClick={handleOpenSettings}
                  style={{ padding: '5px 10px', marginRight: '10px' }}
                >
                  Settings
                </button>
                <button 
                  onClick={signOut} 
                  style={{ padding: '5px 10px' }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Settings Modal */}
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      </CRDTProvider>
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
