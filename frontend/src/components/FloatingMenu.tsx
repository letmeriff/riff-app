import React from 'react';

interface FloatingMenuProps {
  onCreateNode: () => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({ onCreateNode }) => {
  return (
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
      <button onClick={onCreateNode}>Create Node</button>
    </div>
  );
};

export default FloatingMenu; 