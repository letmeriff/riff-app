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
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  },
}));

// Type definitions - used for documentation purposes
interface CanvasPermissionType {
  id: string;
  canvas_id: string;
  user_id: string;
  permission_level: 'view' | 'edit' | 'admin';
  created_at: string;
}

// Permission levels - used for reference in tests
const PERMISSION_LEVELS_ENUM = {
  VIEW: 'view',   // Can only view the canvas
  EDIT: 'edit',   // Can view and edit the canvas
  ADMIN: 'admin', // Can view, edit and manage permissions
};

// Permission level type definition
type PermissionLevel = 'view' | 'edit' | 'admin';

// Permission levels enum
const PERMISSION_LEVELS = {
  VIEW: 'view' as PermissionLevel,   // Can only view the canvas
  EDIT: 'edit' as PermissionLevel,   // Can view and edit the canvas
  ADMIN: 'admin' as PermissionLevel, // Can view, edit and manage permissions
};

// Helper function to share a canvas with a user
async function shareCanvas(
  canvasId: string,
  userId: string,
  permissionLevel: PermissionLevel
) {
  // Check if permission already exists
  const { data: existingPermission } = await supabase
    .from('canvas_permissions')
    .select('*')
    .eq('canvas_id', canvasId)
    .eq('user_id', userId)
    .single();
  
  if (existingPermission) {
    // Update existing permission
    const { data, error } = await supabase
      .from('canvas_permissions')
      .update({
        permission_level: permissionLevel,
      })
      .eq('id', existingPermission.id)
      .single();
    
    if (error) {
      throw new Error(`Failed to update canvas permission: ${error.message}`);
    }
    
    return data;
  } else {
    // Create new permission
    const { data, error } = await supabase
      .from('canvas_permissions')
      .insert({
        id: `perm-${Date.now()}`,
        canvas_id: canvasId,
        user_id: userId,
        permission_level: permissionLevel,
        created_at: new Date().toISOString(),
      })
      .single();
    
    if (error) {
      throw new Error(`Failed to share canvas: ${error.message}`);
    }
    
    return data;
  }
}

// Helper function to remove canvas access for a user
async function removeCanvasAccess(canvasId: string, userId: string) {
  const { error } = await supabase
    .from('canvas_permissions')
    .delete()
    .eq('canvas_id', canvasId)
    .eq('user_id', userId);
  
  if (error) {
    throw new Error(`Failed to remove canvas access: ${error.message}`);
  }
  
  return { success: true };
}

// Helper function to get all users with access to a canvas
async function getCanvasCollaborators(canvasId: string) {
  const { data, error } = await supabase
    .from('canvas_permissions')
    .select(`
      id,
      permission_level,
      user:users(
        id,
        name,
        email,
        avatar_url
      )
    `)
    .eq('canvas_id', canvasId);
  
  if (error) {
    throw new Error(`Failed to get canvas collaborators: ${error.message}`);
  }
  
  return data;
}

// Helper function to check if a user has permission to access a canvas
async function checkCanvasPermission(
  canvasId: string,
  userId: string,
  requiredLevel: 'view' | 'edit' | 'admin'
) {
  // First, check if the user is the owner
  const { data: canvas } = await supabase
    .from('canvases')
    .select('created_by')
    .eq('id', canvasId)
    .single();
  
  if (canvas?.created_by === userId) {
    return { hasPermission: true, isOwner: true };
  }
  
  // Check explicit permissions
  const { data: permission } = await supabase
    .from('canvas_permissions')
    .select('permission_level')
    .eq('canvas_id', canvasId)
    .eq('user_id', userId)
    .single();
  
  if (!permission) {
    return { hasPermission: false, isOwner: false };
  }
  
  // Map permission levels to numeric values for comparison
  const permissionValues = {
    'view': 1,
    'edit': 2,
    'admin': 3,
  };
  
  const userPermissionValue = permissionValues[permission.permission_level];
  const requiredPermissionValue = permissionValues[requiredLevel];
  
  return {
    hasPermission: userPermissionValue >= requiredPermissionValue,
    isOwner: false,
  };
}

describe('Canvas Permissions Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the mock implementations
    (supabase.from as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    }));
  });
  
  describe('Share Canvas', () => {
    test('should create a new permission when sharing a canvas for the first time', async () => {
      // Mock the Supabase responses
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      }));
      
      const mockPermission = {
        id: 'perm-123',
        canvas_id: 'canvas-123',
        user_id: 'user-456',
        permission_level: PERMISSION_LEVELS.EDIT,
        created_at: '2023-01-01T00:00:00.000Z',
      };
      
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: mockPermission,
          error: null,
        }),
      }));
      
      // Call the function
      const permission = await shareCanvas('canvas-123', 'user-456', PERMISSION_LEVELS.EDIT);
      
      // Assertions
      expect(permission).toEqual(mockPermission);
      expect(supabase.from).toHaveBeenCalledWith('canvas_permissions');
    });
    
    test('should update existing permission when sharing with a user who already has access', async () => {
      // Mock existing permission
      const existingPermission = {
        id: 'perm-123',
        canvas_id: 'canvas-123',
        user_id: 'user-456',
        permission_level: 'view',
        created_at: '2023-01-01T00:00:00.000Z',
      };
      
      // Mock the Supabase responses
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: existingPermission,
          error: null,
        }),
      }));
      
      const updatedPermission = {
        ...existingPermission,
        permission_level: 'admin',
      };
      
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: updatedPermission,
          error: null,
        }),
      }));
      
      // Call the function
      const permission = await shareCanvas('canvas-123', 'user-456', 'admin');
      
      // Assertions
      expect(permission).toEqual(updatedPermission);
      expect(supabase.from).toHaveBeenCalledWith('canvas_permissions');
    });
    
    test('should throw an error if sharing fails', async () => {
      // Mock the Supabase responses
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      }));
      
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        }),
      }));
      
      // Call and expect error
      await expect(
        shareCanvas('canvas-123', 'user-456', 'edit')
      ).rejects.toThrow('Failed to share canvas: Database error');
    });
  });
  
  describe('Remove Canvas Access', () => {
    test('should remove a user\'s access to a canvas', async () => {
      // Mock the Supabase response
      (supabase.from as jest.Mock).mockImplementation(() => ({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        mockResolvedValueOnce: jest.fn().mockResolvedValueOnce({
          error: null,
        }),
      }));
      
      // Call the function
      const result = await removeCanvasAccess('canvas-123', 'user-456');
      
      // Assertions
      expect(result).toEqual({ success: true });
      expect(supabase.from).toHaveBeenCalledWith('canvas_permissions');
    });
    
    test('should throw an error if removal fails', async () => {
      // Mock the error response for both eq calls in the chain
      const secondEq = jest.fn().mockResolvedValue({
        error: { message: 'Permission not found' }
      });
      
      const firstEq = jest.fn().mockReturnValue({
        eq: secondEq
      });
      
      const mockDelete = jest.fn().mockReturnValue({
        eq: firstEq
      });
      
      // Set up the mock chain
      (supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete
      });
      
      // Call and expect error
      await expect(
        removeCanvasAccess('canvas-123', 'user-456')
      ).rejects.toThrow('Failed to remove canvas access: Permission not found');
    });
  });
  
  describe('Get Canvas Collaborators', () => {
    test('should get all collaborators for a canvas', async () => {
      // Mock collaborators
      const mockCollaborators = [
        {
          id: 'perm-123',
          permission_level: 'edit',
          user: {
            id: 'user-456',
            name: 'Test User 1',
            email: 'user1@example.com',
            avatar_url: 'https://example.com/avatar1.png',
          },
        },
        {
          id: 'perm-124',
          permission_level: 'view',
          user: {
            id: 'user-789',
            name: 'Test User 2',
            email: 'user2@example.com',
            avatar_url: 'https://example.com/avatar2.png',
          },
        },
      ];
      
      // Mock the Supabase response
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValueOnce({
          data: mockCollaborators,
          error: null,
        }),
      }));
      
      // Call the function
      const collaborators = await getCanvasCollaborators('canvas-123');
      
      // Assertions
      expect(collaborators).toEqual(mockCollaborators);
      expect(supabase.from).toHaveBeenCalledWith('canvas_permissions');
    });
    
    test('should throw an error if fetching collaborators fails', async () => {
      // Mock the Supabase response with an error
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        }),
      }));
      
      // Call and expect error
      await expect(
        getCanvasCollaborators('canvas-123')
      ).rejects.toThrow('Failed to get canvas collaborators: Database error');
    });
  });
  
  describe('Check Canvas Permission', () => {
    test('should return true for owner access regardless of required permission', async () => {
      // Mock the Supabase response for canvas owner check
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: { created_by: 'user-123' },
          error: null,
        }),
      }));
      
      // Call the function
      const result = await checkCanvasPermission('canvas-123', 'user-123', 'admin');
      
      // Assertions
      expect(result).toEqual({ hasPermission: true, isOwner: true });
    });
    
    test('should return correct permission status for non-owner with sufficient permission', async () => {
      // Mock the Supabase response for canvas owner check
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: { created_by: 'user-789' },
          error: null,
        }),
      }));
      
      // Mock the permission check with EDIT permission level
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: { permission_level: PERMISSION_LEVELS.EDIT },
          error: null,
        }),
      }));
      
      // Call the function
      const result = await checkCanvasPermission('canvas-123', 'user-456', PERMISSION_LEVELS.EDIT);
      
      // Assertions
      expect(result).toEqual({ hasPermission: true, isOwner: false });
    });
    
    test('should return false for non-owner with insufficient permission', async () => {
      // Mock the Supabase response for canvas owner check
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: { created_by: 'user-789' },
          error: null,
        }),
      }));
      
      // Mock the permission check
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: { permission_level: 'view' },
          error: null,
        }),
      }));
      
      // Call the function
      const result = await checkCanvasPermission('canvas-123', 'user-456', 'edit');
      
      // Assertions
      expect(result).toEqual({ hasPermission: false, isOwner: false });
    });
    
    test('should return false for user with no permission', async () => {
      // Mock the Supabase response for canvas owner check
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: { created_by: 'user-789' },
          error: null,
        }),
      }));
      
      // Mock the permission check (no permission)
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      }));
      
      // Call the function
      const result = await checkCanvasPermission('canvas-123', 'user-456', 'view');
      
      // Assertions
      expect(result).toEqual({ hasPermission: false, isOwner: false });
    });
  });
}); 