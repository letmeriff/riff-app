import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface Model {
  id: number;
  model_name: string;
  api_key: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [models, setModels] = useState<Model[]>([]);
  const [modelName, setModelName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch models when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    fetchModels();
  }, [isOpen]);

  const fetchModels = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get the current session token using Supabase's current method
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch('http://localhost:3001/api/models', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      setModels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching models:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Get the current session token using Supabase's current method
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch('http://localhost:3001/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ model_name: modelName, api_key: apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add model');
      }

      setModels((prev) => [...prev, data]);
      setModelName('');
      setApiKey('');
      setSuccess('Model added successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error adding model:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteModel = async (modelId: number) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Get the current session token using Supabase's current method
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`http://localhost:3001/api/models/${modelId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete model');
      }

      setModels((prev) => prev.filter((model) => model.id !== modelId));
      setSuccess('Model deleted successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error deleting model:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '5px',
          width: '500px',
          maxWidth: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2>API Key Management</h2>
        
        {error && (
          <div style={{ color: 'red', marginBottom: '15px', padding: '10px', background: '#ffeeee', borderRadius: '4px' }}>
            {error}
          </div>
        )}
        
        {success && (
          <div style={{ color: 'green', marginBottom: '15px', padding: '10px', background: '#eeffee', borderRadius: '4px' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleAddModel} style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="modelName" style={{ display: 'block', marginBottom: '5px' }}>
              Model:
            </label>
            <select
              id="modelName"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              required
            >
              <option value="">Select a model</option>
              <option value="openai/gpt-4">OpenAI GPT-4</option>
              <option value="openai/gpt-3.5-turbo">OpenAI GPT-3.5 Turbo</option>
              <option value="anthropic/claude-3-sonnet-20240229">Anthropic Claude 3 Sonnet</option>
              <option value="anthropic/claude-3-opus-20240229">Anthropic Claude 3 Opus</option>
            </select>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="apiKey" style={{ display: 'block', marginBottom: '5px' }}>
              API Key:
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              background: '#4299e1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Adding...' : 'Add Model'}
          </button>
        </form>

        <h3>Your Models</h3>
        {isLoading && models.length === 0 ? (
          <div>Loading models...</div>
        ) : models.length === 0 ? (
          <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
            No models added yet. Add a model above to get started.
          </div>
        ) : (
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {models.map((model) => (
              <li
                key={model.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  borderBottom: '1px solid #eee',
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{model.model_name}</div>
                  <div style={{ fontSize: '0.8em', color: '#666' }}>API Key: ••••••••••••••••</div>
                </div>
                <button
                  onClick={() => handleDeleteModel(model.id)}
                  disabled={isLoading}
                  style={{
                    padding: '5px 10px',
                    background: '#f56565',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 