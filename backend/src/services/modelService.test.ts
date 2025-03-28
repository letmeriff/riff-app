import { getUserModels, addUserModel, deleteUserModel } from './modelService';
import { supabase } from '../config/supabase';
import crypto from 'crypto';

// Mock Supabase client
jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));

// Mock crypto for encryption/decryption
jest.mock('crypto', () => ({
  createCipheriv: jest.fn(),
  createDecipheriv: jest.fn(),
  randomBytes: jest.fn(),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash')
  }))
}));

describe('modelService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserModels', () => {
    it('fetches user models from the database', async () => {
      // Mock the user models data
      const mockUserModels = [
        { id: 1, user_id: 'user1', model_name: 'gpt-4', api_key: 'encrypted-key-1', iv: 'iv1' },
        { id: 2, user_id: 'user1', model_name: 'gpt-3.5-turbo', api_key: 'encrypted-key-2', iv: 'iv2' }
      ];
      
      // Set up mock implementation for Supabase query builder
      const selectMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockReturnThis();
      const fromMock = jest.fn().mockReturnValue({
        select: selectMock,
        eq: eqMock
      });
      
      // Mock the final query response
      eqMock.mockResolvedValue({
        data: mockUserModels,
        error: null
      });
      
      (supabase.from as jest.Mock).mockImplementation(fromMock);
      
      // Call the function
      const result = await getUserModels('user1');
      
      // Assertions
      expect(supabase.from).toHaveBeenCalledWith('user_models');
      expect(selectMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('user_id', 'user1');
      expect(result).toEqual(mockUserModels);
    });

    it('returns an empty array when no models found', async () => {
      // Set up mock implementation for Supabase query builder
      const selectMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockReturnThis();
      const fromMock = jest.fn().mockReturnValue({
        select: selectMock,
        eq: eqMock
      });
      
      // Mock the final query response with no data
      eqMock.mockResolvedValue({
        data: [],
        error: null
      });
      
      (supabase.from as jest.Mock).mockImplementation(fromMock);
      
      // Call the function
      const result = await getUserModels('user1');
      
      // Assertions
      expect(result).toEqual([]);
    });

    it('throws an error when the database query fails', async () => {
      // Set up mock implementation for Supabase query builder
      const selectMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockReturnThis();
      const fromMock = jest.fn().mockReturnValue({
        select: selectMock,
        eq: eqMock
      });
      
      // Mock the final query response with an error
      eqMock.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });
      
      (supabase.from as jest.Mock).mockImplementation(fromMock);
      
      // Call the function and expect it to throw
      await expect(getUserModels('user1')).rejects.toThrow('Database error');
    });
  });

  describe('addUserModel', () => {
    it('adds a new user model with encrypted API key', async () => {
      // Mock the encrypted key and iv
      const mockIv = Buffer.from('mock-iv');
      const mockCipher = {
        update: jest.fn().mockReturnValue(Buffer.from('encrypted-part')),
        final: jest.fn().mockReturnValue(Buffer.from('-final'))
      };
      
      // Mock crypto functions
      (crypto.randomBytes as jest.Mock).mockReturnValue(mockIv);
      (crypto.createCipheriv as jest.Mock).mockReturnValue(mockCipher);
      
      // Mock the user model data
      const mockNewUserModel = { 
        id: 3, 
        user_id: 'user1', 
        model_name: 'gpt-4', 
        api_key: 'encrypted-part-final',
        iv: mockIv.toString('hex')
      };
      
      // Set up mock implementation for Supabase query builder
      const insertMock = jest.fn().mockResolvedValue({
        data: mockNewUserModel,
        error: null
      });
      
      const fromMock = jest.fn().mockReturnValue({
        insert: insertMock
      });
      
      (supabase.from as jest.Mock).mockImplementation(fromMock);
      
      // Call the function
      const result = await addUserModel('user1', 'gpt-4', 'api-key-123');
      
      // Assertions
      expect(crypto.randomBytes).toHaveBeenCalledWith(16);
      expect(crypto.createCipheriv).toHaveBeenCalled();
      expect(mockCipher.update).toHaveBeenCalledWith('api-key-123', 'utf8', 'hex');
      expect(mockCipher.final).toHaveBeenCalledWith('hex');
      
      expect(supabase.from).toHaveBeenCalledWith('user_models');
      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user1',
        model_name: 'gpt-4',
        api_key: 'encrypted-part-final',
        iv: mockIv.toString('hex')
      });
      
      expect(result).toEqual(mockNewUserModel);
    });

    it('throws an error when the insertion fails', async () => {
      // Mock the encrypted key and iv
      const mockIv = Buffer.from('mock-iv');
      const mockCipher = {
        update: jest.fn().mockReturnValue(Buffer.from('encrypted-part')),
        final: jest.fn().mockReturnValue(Buffer.from('-final'))
      };
      
      // Mock crypto functions
      (crypto.randomBytes as jest.Mock).mockReturnValue(mockIv);
      (crypto.createCipheriv as jest.Mock).mockReturnValue(mockCipher);
      
      // Set up mock implementation for Supabase query builder
      const insertMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Insertion error' }
      });
      
      const fromMock = jest.fn().mockReturnValue({
        insert: insertMock
      });
      
      (supabase.from as jest.Mock).mockImplementation(fromMock);
      
      // Call the function and expect it to throw
      await expect(addUserModel('user1', 'gpt-4', 'api-key-123')).rejects.toThrow('Insertion error');
    });
  });

  describe('deleteUserModel', () => {
    it('deletes a user model by ID', async () => {
      // Set up mock implementation for Supabase query builder
      const deleteMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockResolvedValue({
        error: null
      });
      
      const fromMock = jest.fn().mockReturnValue({
        delete: deleteMock,
        eq: eqMock
      });
      
      (supabase.from as jest.Mock).mockImplementation(fromMock);
      
      // Call the function
      await deleteUserModel(1);
      
      // Assertions
      expect(supabase.from).toHaveBeenCalledWith('user_models');
      expect(deleteMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('id', 1);
    });

    it('throws an error when the deletion fails', async () => {
      // Set up mock implementation for Supabase query builder
      const deleteMock = jest.fn().mockReturnThis();
      const eqMock = jest.fn().mockResolvedValue({
        error: { message: 'Deletion error' }
      });
      
      const fromMock = jest.fn().mockReturnValue({
        delete: deleteMock,
        eq: eqMock
      });
      
      (supabase.from as jest.Mock).mockImplementation(fromMock);
      
      // Call the function and expect it to throw
      await expect(deleteUserModel(1)).rejects.toThrow('Deletion error');
    });
  });
}); 