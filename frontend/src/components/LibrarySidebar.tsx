import React, { useEffect, useState } from 'react';
import { fetchPromptsWithStarred, toggleStarPrompt, updatePrompt, Prompt } from '../services/promptService';
import { useAuth } from '../contexts/AuthContext';

interface LibrarySidebarProps {
  onPromptDrag: (prompt: Prompt) => void;
}

type SortOption = 'name' | 'newest' | 'oldest';

const LibrarySidebar: React.FC<LibrarySidebarProps> = ({ onPromptDrag }) => {
  const { user } = useAuth();
  const [starredPrompts, setStarredPrompts] = useState<Prompt[]>([]);
  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'starred'>('all');

  useEffect(() => {
    async function loadPrompts() {
      if (!user) return;
      
      try {
        setIsLoading(true);
        console.log('Fetching prompts with starred status...');
        const { starred, all } = await fetchPromptsWithStarred(user.id);
        console.log('Starred prompts:', starred);
        console.log('All prompts:', all);
        setStarredPrompts(starred);
        setAllPrompts(all);
        setError(null);
      } catch (err) {
        console.error('Error loading prompts:', err);
        setError('Failed to load prompts. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    loadPrompts();
  }, [user]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, prompt: Prompt) => {
    e.dataTransfer.setData('application/json', JSON.stringify(prompt));
    if (onPromptDrag) {
      onPromptDrag(prompt);
    }
  };

  const handleToggleStar = async (prompt: Prompt) => {
    if (!user) return;
    
    try {
      await toggleStarPrompt(user.id, prompt.id, !prompt.is_starred);
      // Reload prompts after toggling star
      const { starred, all } = await fetchPromptsWithStarred(user.id);
      setStarredPrompts(starred);
      setAllPrompts(all);
    } catch (err) {
      console.error('Error toggling star:', err);
      setError('Failed to update star status. Please try again.');
    }
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt({ ...prompt });
  };

  const handleEditChange = (field: keyof Prompt, value: string) => {
    if (!editingPrompt) return;
    setEditingPrompt({ ...editingPrompt, [field]: value });
  };

  const handleSaveEdit = async () => {
    if (!editingPrompt || !user) return;
    
    try {
      await updatePrompt(editingPrompt.id, editingPrompt);
      // Reload prompts after editing
      const { starred, all } = await fetchPromptsWithStarred(user.id);
      setStarredPrompts(starred);
      setAllPrompts(all);
      setEditingPrompt(null);
    } catch (err) {
      console.error('Error saving edit:', err);
      setError('Failed to save changes. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingPrompt(null);
  };

  const sortPrompts = (prompts: Prompt[]): Prompt[] => {
    const filteredPrompts = searchTerm 
      ? prompts.filter(p => 
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          p.description?.toLowerCase().includes(searchTerm.toLowerCase()))
      : prompts;

    switch (sortBy) {
      case 'name':
        return [...filteredPrompts].sort((a, b) => a.name.localeCompare(b.name));
      case 'newest':
        return [...filteredPrompts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return [...filteredPrompts].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      default:
        return filteredPrompts;
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        padding: '16px', 
        width: '300px', 
        height: '100%', 
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFAFA'
      }}>
        <div>Loading library...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '16px', 
        width: '300px', 
        height: '100%', 
        borderRight: '1px solid #E2E8F0',
        backgroundColor: '#FAFAFA'
      }}>
        <div style={{ color: '#E53E3E', padding: '12px', backgroundColor: '#FED7D7', borderRadius: '4px' }}>
          {error}
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginLeft: '8px',
              padding: '4px 8px',
              backgroundColor: '#E53E3E',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Group prompts by type
  const frameworks = sortPrompts(allPrompts.filter(p => p.type === 'framework'));
  const templates = sortPrompts(allPrompts.filter(p => p.type === 'template'));
  const sortedStarredPrompts = sortPrompts(starredPrompts);

  return (
    <div style={{ 
      width: '300px', 
      height: '100%', 
      borderRight: '1px solid #E2E8F0',
      backgroundColor: '#FAFAFA',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid #E2E8F0', 
        backgroundColor: 'white' 
      }}>
        <h2 style={{ 
          marginBottom: '16px', 
          fontSize: '20px', 
          fontWeight: 'bold',
          color: '#2D3748'
        }}>
          Library
        </h2>

        <div style={{ 
          position: 'relative',
          marginBottom: '16px'
        }}>
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search prompts..."
            style={{
              width: '100%',
              padding: '8px 12px',
              paddingLeft: '32px',
              borderRadius: '6px',
              border: '1px solid #CBD5E0',
              fontSize: '14px'
            }}
          />
          <span style={{ 
            position: 'absolute', 
            left: '10px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            fontSize: '14px',
            color: '#718096'
          }}>
            🔍
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: activeTab === 'all' ? '#EBF8FF' : 'white',
              border: '1px solid #CBD5E0',
              borderRadius: '6px',
              color: activeTab === 'all' ? '#3182CE' : '#4A5568',
              fontWeight: activeTab === 'all' ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('starred')}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: activeTab === 'starred' ? '#EBF8FF' : 'white',
              border: '1px solid #CBD5E0',
              borderRadius: '6px',
              color: activeTab === 'starred' ? '#3182CE' : '#4A5568',
              fontWeight: activeTab === 'starred' ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            Starred
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: '#4A5568' }}>Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{
              padding: '6px',
              border: '1px solid #CBD5E0',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="name">Name</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex', 
        flexDirection: 'column', 
        gap: '24px' 
      }}>
        {activeTab === 'starred' ? (
          <div>
            <h3 style={{ 
              marginBottom: '12px', 
              fontSize: '16px', 
              fontWeight: 'bold',
              color: '#2D3748',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '6px' }}>⭐</span> Starred Items
            </h3>
            {sortedStarredPrompts.length === 0 ? (
              <div style={{ 
                color: '#718096', 
                padding: '16px', 
                textAlign: 'center',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px dashed #CBD5E0'
              }}>
                No starred items<br />
                <small>Star your favorite prompts to find them easily</small>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sortedStarredPrompts.map((prompt) => (
                  <PromptCard 
                    key={prompt.id} 
                    prompt={prompt} 
                    handleDragStart={handleDragStart}
                    handleToggleStar={handleToggleStar}
                    handleEditPrompt={handleEditPrompt}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Frameworks Section */}
            <div>
              <h3 style={{ 
                marginBottom: '12px', 
                fontSize: '16px', 
                fontWeight: 'bold',
                color: '#2D3748',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ marginRight: '6px' }}>📑</span> Frameworks
              </h3>
              {frameworks.length === 0 ? (
                <div style={{ 
                  color: '#718096', 
                  padding: '16px', 
                  textAlign: 'center',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px dashed #CBD5E0'
                }}>
                  No frameworks available
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {frameworks.map((framework) => (
                    <PromptCard 
                      key={framework.id} 
                      prompt={framework} 
                      handleDragStart={handleDragStart}
                      handleToggleStar={handleToggleStar}
                      handleEditPrompt={handleEditPrompt}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Templates Section */}
            <div>
              <h3 style={{ 
                marginBottom: '12px', 
                fontSize: '16px', 
                fontWeight: 'bold',
                color: '#2D3748',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ marginRight: '6px' }}>📝</span> Templates
              </h3>
              {templates.length === 0 ? (
                <div style={{ 
                  color: '#718096', 
                  padding: '16px', 
                  textAlign: 'center',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px dashed #CBD5E0'
                }}>
                  No templates available
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {templates.map((template) => (
                    <PromptCard 
                      key={template.id} 
                      prompt={template} 
                      handleDragStart={handleDragStart}
                      handleToggleStar={handleToggleStar}
                      handleEditPrompt={handleEditPrompt}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit Prompt Modal */}
      {editingPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '600px',
            maxWidth: '90%',
            maxHeight: '90%',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              marginBottom: '20px',
              color: '#2D3748',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '8px' }}>
                {editingPrompt.type === 'framework' ? '📑' : '📝'}
              </span>
              Edit {editingPrompt.type === 'framework' ? 'Framework' : 'Template'}
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4A5568' }}>Name</label>
              <input 
                type="text" 
                value={editingPrompt.name}
                onChange={(e) => handleEditChange('name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E0',
                  fontSize: '16px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4A5568' }}>Description</label>
              <input 
                type="text" 
                value={editingPrompt.description || ''}
                onChange={(e) => handleEditChange('description', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E0',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4A5568' }}>Content</label>
              <textarea 
                value={editingPrompt.content}
                onChange={(e) => handleEditChange('content', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E0',
                  minHeight: '250px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={handleCancelEdit}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E0',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#4A5568'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                style={{
                  padding: '10px 24px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#3182CE',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for prompt cards
const PromptCard: React.FC<{
  prompt: Prompt;
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, prompt: Prompt) => void;
  handleToggleStar: (prompt: Prompt) => void;
  handleEditPrompt: (prompt: Prompt) => void;
}> = ({ prompt, handleDragStart, handleToggleStar, handleEditPrompt }) => {
  return (
    <div
      style={{ 
        padding: '12px', 
        backgroundColor: 'white', 
        borderRadius: '6px',
        border: '1px solid #E2E8F0',
        cursor: 'grab',
        display: 'flex',
        justifyContent: 'space-between',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}
      draggable
      onDragStart={(e) => handleDragStart(e, prompt)}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = '#F8FAFC';
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'white';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ flex: 1, paddingRight: '8px' }}>
        <div style={{ fontWeight: 'bold', color: '#2D3748', marginBottom: '4px' }}>{prompt.name}</div>
        {prompt.description && (
          <div style={{ fontSize: '14px', color: '#718096' }}>{prompt.description}</div>
        )}
        <div style={{ 
          fontSize: '12px', 
          color: '#4A5568', 
          marginTop: '6px', 
          display: 'flex', 
          alignItems: 'center' 
        }}>
          <span style={{ marginRight: '4px' }}>
            {prompt.type === 'framework' ? '📑' : '📝'}
          </span>
          {prompt.type}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEditPrompt(prompt);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#718096',
            transition: 'color 0.2s ease',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = '#3182CE';
            e.currentTarget.style.backgroundColor = '#EBF8FF';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = '#718096';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="Edit"
        >
          ✏️
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleStar(prompt);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: prompt.is_starred ? '#ECC94B' : '#718096',
            transition: 'transform 0.2s ease, color 0.2s ease',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.color = prompt.is_starred ? '#D69E2E' : '#ECC94B';
            e.currentTarget.style.backgroundColor = '#FFFBEB';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.color = prompt.is_starred ? '#ECC94B' : '#718096';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title={prompt.is_starred ? "Unstar" : "Star"}
        >
          {prompt.is_starred ? "⭐" : "☆"}
        </button>
      </div>
    </div>
  );
};

export default LibrarySidebar; 