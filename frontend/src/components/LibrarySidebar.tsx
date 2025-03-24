import React, { useEffect, useState } from 'react';
import { fetchFrameworks, fetchTemplates, Prompt } from '../services/promptService';

interface LibrarySidebarProps {
  onPromptDrag: (prompt: Prompt) => void;
}

const LibrarySidebar: React.FC<LibrarySidebarProps> = ({ onPromptDrag }) => {
  const [frameworks, setFrameworks] = useState<Prompt[]>([]);
  const [templates, setTemplates] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrompts() {
      try {
        setIsLoading(true);
        const [frameworksData, templatesData] = await Promise.all([
          fetchFrameworks(),
          fetchTemplates()
        ]);
        setFrameworks(frameworksData);
        setTemplates(templatesData);
        setError(null);
      } catch (err) {
        console.error('Error loading prompts:', err);
        setError('Failed to load prompts. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    loadPrompts();
  }, []);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, prompt: Prompt) => {
    e.dataTransfer.setData('application/json', JSON.stringify(prompt));
    if (onPromptDrag) {
      onPromptDrag(prompt);
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        padding: '16px', 
        width: '250px', 
        height: '100%', 
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '16px', 
        width: '250px', 
        height: '100%', 
        borderRight: '1px solid #E2E8F0' 
      }}>
        <div style={{ color: 'red' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '16px', 
      width: '250px', 
      height: '100%', 
      borderRight: '1px solid #E2E8F0',
      overflowY: 'auto'
    }}>
      <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>Library</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Frameworks Section */}
        <div>
          <h3 style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 'bold' }}>Frameworks</h3>
          <hr style={{ marginBottom: '8px' }} />
          {frameworks.length === 0 ? (
            <div style={{ color: '#718096' }}>No frameworks available</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {frameworks.map((framework) => (
                <div
                  key={framework.id}
                  style={{ 
                    padding: '8px', 
                    backgroundColor: '#F7FAFC', 
                    borderRadius: '4px',
                    cursor: 'grab'
                  }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, framework)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#EBF8FF';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#F7FAFC';
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{framework.name}</div>
                  <div style={{ fontSize: '14px', color: '#718096' }}>{framework.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Templates Section */}
        <div>
          <h3 style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 'bold' }}>Templates</h3>
          <hr style={{ marginBottom: '8px' }} />
          {templates.length === 0 ? (
            <div style={{ color: '#718096' }}>No templates available</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {templates.map((template) => (
                <div
                  key={template.id}
                  style={{ 
                    padding: '8px', 
                    backgroundColor: '#F7FAFC', 
                    borderRadius: '4px',
                    cursor: 'grab'
                  }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, template)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#EBF8FF';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#F7FAFC';
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{template.name}</div>
                  <div style={{ fontSize: '14px', color: '#718096' }}>{template.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LibrarySidebar; 