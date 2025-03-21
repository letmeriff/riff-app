import React, { useState, useEffect } from 'react';

interface Model {
  id: number;
  model_name: string;
}

interface Flavor {
  id: number;
  name: string;
}

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, modelName: string, flavorName: string) => void;
}

const CreateNodeModal: React.FC<CreateNodeModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [modelName, setModelName] = useState('');
  const [flavorName, setFlavorName] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch models and flavors when the modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Get the token from localStorage
        const token = localStorage.getItem('supabase.auth.token');
        if (!token) {
          throw new Error('Authentication token not found');
        }

        // Fetch models
        const modelsResponse = await fetch('http://localhost:3001/api/models', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!modelsResponse.ok) {
          throw new Error('Failed to fetch models');
        }
        
        const modelsData = await modelsResponse.json();
        setModels(modelsData);

        // Fetch flavors
        const flavorsResponse = await fetch('http://localhost:3001/api/flavors', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!flavorsResponse.ok) {
          throw new Error('Failed to fetch flavors');
        }
        
        const flavorsData = await flavorsResponse.json();
        setFlavors(flavorsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !modelName || !flavorName) return;
    onCreate(title, modelName, flavorName);
    // Reset form
    setTitle('');
    setModelName('');
    setFlavorName('');
    onClose();
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
          width: '400px',
          maxWidth: '90%',
        }}
      >
        <h2>Create New Node</h2>
        
        {error && (
          <div style={{ color: 'red', marginBottom: '15px' }}>
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="title" style={{ display: 'block', marginBottom: '5px' }}>
                Title:
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                required
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="model" style={{ display: 'block', marginBottom: '5px' }}>
                Model:
              </label>
              <select
                id="model"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                required
              >
                <option value="">Select a model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.model_name}>
                    {model.model_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="flavor" style={{ display: 'block', marginBottom: '5px' }}>
                Flavor:
              </label>
              <select
                id="flavor"
                value={flavorName}
                onChange={(e) => setFlavorName(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                required
              >
                <option value="">Select a flavor</option>
                {flavors.map((flavor) => (
                  <option key={flavor.id} value={flavor.name}>
                    {flavor.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  background: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '8px 16px',
                  background: '#4299e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Create
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateNodeModal; 