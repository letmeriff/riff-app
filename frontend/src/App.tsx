import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import { supabase } from './services/supabase';
import './styles/auth.css';
import './styles/app.css';

interface ChatNode {
  node_id: number;
  title: string;
  model?: string;
  flavor?: string;
  created_at: string;
}

const AppContent: React.FC = () => {
  const { user, session, signOut } = useAuth();
  const [nodes, setNodes] = useState<ChatNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchNodes();
    }
  }, [user]);

  const fetchNodes = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_nodes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNodes(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching nodes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch nodes');
    }
  };

  const createTestNode = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('chat_nodes')
        .insert({ title: 'Test Node', user_id: user.id });

      if (error) throw error;
      await fetchNodes(); // Refresh the list
    } catch (err) {
      console.error('Error creating node:', err);
      setError(err instanceof Error ? err.message : 'Failed to create node');
    }
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
    <div className="app-container">
      <header>
        <h1>Welcome to RIFF</h1>
        <div className="user-info">
          <span>Logged in as: {user.email}</span>
          <button onClick={signOut}>Logout</button>
        </div>
      </header>

      <main>
        <div className="actions">
          <button onClick={createTestNode}>Create Test Node</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="nodes-list">
          <h2>Your Chat Nodes</h2>
          {nodes.length === 0 ? (
            <p>No chat nodes found. Create one to get started!</p>
          ) : (
            <ul>
              {nodes.map((node) => (
                <li key={node.node_id}>
                  <strong>{node.title}</strong>
                  {node.model && <span> - Model: {node.model}</span>}
                  {node.flavor && <span> - Flavor: {node.flavor}</span>}
                  <br />
                  <small>Created: {new Date(node.created_at).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
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