import React, { useState } from 'react';
import CreateNodeModal from './CreateNodeModal';

interface FloatingMenuProps {
  onCreateNode: (title: string, modelName: string, flavorName: string) => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({ onCreateNode }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleNodeCreate = (title: string, modelName: string, flavorName: string) => {
    onCreateNode(title, modelName, flavorName);
  };

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          background: '#fff',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        }}
      >
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '8px 16px',
            background: '#4299e1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Create Node
        </button>
      </div>
      
      <CreateNodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleNodeCreate}
      />
    </>
  );
};

export default FloatingMenu; 