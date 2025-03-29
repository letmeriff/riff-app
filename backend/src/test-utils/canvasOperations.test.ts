import { supabase } from '../config/supabase';

// Mock dependencies
jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  },
}));

// Helper function to create a canvas
async function createCanvas(data: {
  name: string;
  createdBy: string;
}) {
  const { name, createdBy } = data;
  
  const { data: result, error } = await supabase
    .from('canvases')
    .insert({
      id: `canvas-${Date.now()}`,
      name,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    })
    .single();
  
  if (error) {
    throw new Error(`Failed to create canvas: ${error.message}`);
  }
  
  return result;
}

// Helper function to get a canvas by ID
async function getCanvasById(id: string) {
  const { data, error } = await supabase
    .from('canvases')
    .select(`
      id,
      name,
      created_by,
      created_at,
      nodes:nodes(
        id,
        data,
        position_x,
        position_y
      ),
      edges:edges(
        id,
        source,
        target
      )
    `)
    .eq('id', id)
    .single();
  
  if (error) {
    throw new Error(`Failed to get canvas: ${error.message}`);
  }
  
  return data;
}

// Helper function to update a canvas
async function updateCanvas(id: string, updates: { name?: string }) {
  const { data, error } = await supabase
    .from('canvases')
    .update(updates)
    .eq('id', id)
    .single();
  
  if (error) {
    throw new Error(`Failed to update canvas: ${error.message}`);
  }
  
  return data;
}

// Helper function to delete a canvas
async function deleteCanvas(id: string) {
  const { error } = await supabase
    .from('canvases')
    .delete()
    .eq('id', id);
  
  if (error) {
    throw new Error(`Failed to delete canvas: ${error.message}`);
  }
  
  return { success: true };
}

describe('Canvas CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the mock implementations for each test
    (supabase.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    }));
  });
  
  describe('Create Canvas', () => {
    test('should create a new canvas', async () => {
      // Mock the Supabase response
      const mockCanvas = {
        id: 'canvas-123',
        name: 'Test Canvas',
        created_by: 'user-123',
        created_at: '2023-01-01T00:00:00.000Z',
      };
      
      (supabase.from as jest.Mock).mockImplementation(() => ({
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: mockCanvas,
          error: null,
        }),
      }));
      
      // Call the function
      const canvas = await createCanvas({
        name: 'Test Canvas',
        createdBy: 'user-123',
      });
      
      // Assertions
      expect(canvas).toEqual(mockCanvas);
      expect(supabase.from).toHaveBeenCalledWith('canvases');
    });
    
    test('should throw an error if canvas creation fails', async () => {
      // Mock the Supabase response with an error
      (supabase.from as jest.Mock).mockImplementation(() => ({
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        }),
      }));
      
      // Call and expect error
      await expect(
        createCanvas({
          name: 'Test Canvas',
          createdBy: 'user-123',
        })
      ).rejects.toThrow('Failed to create canvas: Database error');
    });
  });
  
  describe('Get Canvas', () => {
    test('should get a canvas by ID with its nodes and edges', async () => {
      // Mock the Supabase response
      const mockCanvas = {
        id: 'canvas-123',
        name: 'Test Canvas',
        created_by: 'user-123',
        created_at: '2023-01-01T00:00:00.000Z',
        nodes: [
          {
            id: 'node-1',
            data: { content: 'Node 1' },
            position_x: 100,
            position_y: 200,
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
          },
        ],
      };
      
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: mockCanvas,
          error: null,
        }),
      }));
      
      // Call the function
      const canvas = await getCanvasById('canvas-123');
      
      // Assertions
      expect(canvas).toEqual(mockCanvas);
      expect(supabase.from).toHaveBeenCalledWith('canvases');
    });
    
    test('should throw an error if canvas retrieval fails', async () => {
      // Mock the Supabase response with an error
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Canvas not found' },
        }),
      }));
      
      // Call and expect error
      await expect(getCanvasById('non-existent-canvas')).rejects.toThrow(
        'Failed to get canvas: Canvas not found'
      );
    });
  });
  
  describe('Update Canvas', () => {
    test('should update a canvas name', async () => {
      // Mock the Supabase response
      const mockUpdatedCanvas = {
        id: 'canvas-123',
        name: 'Updated Canvas Name',
        created_by: 'user-123',
        created_at: '2023-01-01T00:00:00.000Z',
      };
      
      (supabase.from as jest.Mock).mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: mockUpdatedCanvas,
          error: null,
        }),
      }));
      
      // Call the function
      const canvas = await updateCanvas('canvas-123', { name: 'Updated Canvas Name' });
      
      // Assertions
      expect(canvas).toEqual(mockUpdatedCanvas);
      expect(supabase.from).toHaveBeenCalledWith('canvases');
    });
    
    test('should throw an error if canvas update fails', async () => {
      // Mock the Supabase response with an error
      (supabase.from as jest.Mock).mockImplementation(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Permission denied' },
        }),
      }));
      
      // Call and expect error
      await expect(
        updateCanvas('canvas-123', { name: 'Updated Name' })
      ).rejects.toThrow('Failed to update canvas: Permission denied');
    });
  });
  
  describe('Delete Canvas', () => {
    test('should delete a canvas', async () => {
      // Mock the Supabase response
      (supabase.from as jest.Mock).mockImplementation(() => ({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValueOnce({
          error: null,
        }),
      }));
      
      // Call the function
      const result = await deleteCanvas('canvas-123');
      
      // Assertions
      expect(result).toEqual({ success: true });
      expect(supabase.from).toHaveBeenCalledWith('canvases');
    });
    
    test('should throw an error if canvas deletion fails', async () => {
      // Mock the Supabase response with an error
      (supabase.from as jest.Mock).mockImplementation(() => ({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValueOnce({
          error: { message: 'Canvas not found' },
        }),
      }));
      
      // Call and expect error
      await expect(deleteCanvas('non-existent-canvas')).rejects.toThrow(
        'Failed to delete canvas: Canvas not found'
      );
    });
  });
}); 