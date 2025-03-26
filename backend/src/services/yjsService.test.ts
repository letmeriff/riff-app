import * as Y from 'yjs';
import * as yjsService from './yjsService';

// Mock Supabase
jest.mock('../config/supabase', () => {
  // Create more sophisticated mock that supports chained method calls
  const createMockQueryBuilder = () => {
    const mock = {
      select: jest.fn(() => mock),
      insert: jest.fn(() => mock),
      update: jest.fn(() => mock),
      delete: jest.fn(() => mock),
      eq: jest.fn(() => mock),
      gt: jest.fn(() => mock),
      lt: jest.fn(() => mock),
      order: jest.fn(() => mock),
      single: jest.fn(() => mock),
      mockResolvedValue: jest.fn((val) => {
        mock.resolvedValue = val;
        return mock;
      }),
      then: jest.fn((callback) => {
        return Promise.resolve(callback(mock.resolvedValue));
      })
    };
    return mock;
  };

  return {
    supabase: {
      from: jest.fn(() => createMockQueryBuilder())
    }
  };
});

// Mock zlib
jest.mock('zlib', () => ({
  gzip: jest.fn((data, callback) => callback(null, Buffer.from(data))),
  gunzip: jest.fn((data, callback) => callback(null, Buffer.from(data))),
}));

// Mock YJS
jest.mock('yjs', () => {
  return {
    Doc: jest.fn().mockImplementation(() => ({
      encodeStateAsUpdate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    })),
    applyUpdate: jest.fn(),
  };
});

describe('yjsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('storeYjsDocument', () => {
    it('should save document to database', async () => {
      // Setup
      const documentId = 'test-doc';
      const version = 1;
      const documentState = new Uint8Array([1, 2, 3]);
      const mockSupabase = require('../config/supabase').supabase;
      
      mockSupabase.from().select().single.mockResolvedValue({ data: null, error: null });
      mockSupabase.from().insert.mockResolvedValue({ error: null });
      
      // Test
      const result = await yjsService.storeYjsDocument(documentId, documentState, version);
      
      // Assertions
      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('yjs_documents');
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });
    
    it('should handle database errors gracefully', async () => {
      // Setup
      const documentId = 'test-doc';
      const version = 1;
      const documentState = new Uint8Array([1, 2, 3]);
      const mockSupabase = require('../config/supabase').supabase;
      
      mockSupabase.from().select().single.mockResolvedValue({ data: null, error: null });
      mockSupabase.from().insert.mockResolvedValue({ error: new Error('Database error') });
      
      // Test
      const result = await yjsService.storeYjsDocument(documentId, documentState, version);
      
      // Assertions
      expect(result).toBe(false);
    });
  });
  
  describe('getYjsDocument', () => {
    it('should retrieve the document', async () => {
      // Setup
      const documentId = 'test-doc';
      const mockData = {
        document_state: new Uint8Array([1, 2, 3]),
        is_compressed: false,
      };
      const mockSupabase = require('../config/supabase').supabase;
      
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockData,
        error: null,
      });
      
      // Test
      const result = await yjsService.getYjsDocument(documentId);
      
      // Assertions
      expect(mockSupabase.from).toHaveBeenCalledWith('yjs_documents');
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });
    
    it('should return null if no document exists and recovery fails', async () => {
      // Setup
      const documentId = 'test-doc';
      const mockSupabase = require('../config/supabase').supabase;
      
      // Mock document not found
      mockSupabase.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: 'Not found' 
      });
      
      // Mock recovery failure - empty updates list
      mockSupabase.from().select().eq().order().mockResolvedValue({
        data: [],
        error: null
      });
      
      // Test
      const result = await yjsService.getYjsDocument(documentId);
      
      // Assertions
      expect(result).toBeNull();
      expect(mockSupabase.from).toHaveBeenNthCalledWith(1, 'yjs_documents');
      expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'yjs_updates');
    });
  });
  
  describe('storeYjsUpdate', () => {
    it('should store an update in the database', async () => {
      // Setup
      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3]);
      const clientId = 'client1';
      const version = 10;
      const mockSupabase = require('../config/supabase').supabase;
      
      mockSupabase.from().insert.mockResolvedValue({ error: null });
      
      // Test
      const result = await yjsService.storeYjsUpdate(documentId, update, clientId, version);
      
      // Assertions
      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('yjs_updates');
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });
  });
  
  describe('getYjsUpdates', () => {
    it('should retrieve updates after a specific version', async () => {
      // Setup
      const documentId = 'test-doc';
      const fromVersion = 5;
      const mockData = [
        { update: new Uint8Array([1, 2, 3]), is_compressed: false },
        { update: new Uint8Array([4, 5, 6]), is_compressed: false },
      ];
      const mockSupabase = require('../config/supabase').supabase;
      
      mockSupabase.from().select().eq().order().gt.mockResolvedValue({
        data: mockData,
        error: null,
      });
      
      // Test
      const result = await yjsService.getYjsUpdates(documentId, fromVersion);
      
      // Assertions
      expect(mockSupabase.from).toHaveBeenCalledWith('yjs_updates');
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('document_id', documentId);
      expect(mockSupabase.from().select().eq().order().gt).toHaveBeenCalledWith('version', fromVersion);
      expect(result.length).toBe(2);
      expect(result[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(result[1]).toEqual(new Uint8Array([4, 5, 6]));
    });
  });
  
  describe('recoverDocumentFromUpdates', () => {
    it('should recover a document from updates', async () => {
      // Setup
      const documentId = 'test-doc';
      const mockSupabase = require('../config/supabase').supabase;
      
      // Set up mock data for getYjsUpdates
      mockSupabase.from().select().eq().order().mockResolvedValue({
        data: [
          { update: new Uint8Array([1, 2, 3]), is_compressed: false },
          { update: new Uint8Array([4, 5, 6]), is_compressed: false }
        ],
        error: null
      });
      
      // Test
      const result = await yjsService.recoverDocumentFromUpdates(documentId);
      
      // Assertions
      expect(mockSupabase.from).toHaveBeenCalledWith('yjs_updates');
      expect(Y.applyUpdate).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
    });
    
    it('should return null if no updates exist', async () => {
      // Setup
      const documentId = 'test-doc';
      const mockSupabase = require('../config/supabase').supabase;
      
      // Set up mock data for getYjsUpdates
      mockSupabase.from().select().eq().order().mockResolvedValue({
        data: [],
        error: null
      });
      
      // Test
      const result = await yjsService.recoverDocumentFromUpdates(documentId);
      
      // Assertions
      expect(result).toBeNull();
    });
  });
  
  describe('createDocumentSnapshot', () => {
    it('should create a snapshot of the document', async () => {
      // Setup
      const documentId = 'test-doc';
      const doc = new Y.Doc();
      const mockSupabase = require('../config/supabase').supabase;
      
      // Mock existing document check
      mockSupabase.from().select().eq().single.mockResolvedValue({ data: null, error: null });
      // Mock successful insert
      mockSupabase.from().insert.mockResolvedValue({ error: null });
      
      // Test
      const result = await yjsService.createDocumentSnapshot(documentId, doc);
      
      // Assertions
      expect(mockSupabase.from).toHaveBeenCalledWith('yjs_documents');
      expect(mockSupabase.from().insert).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
  
  describe('cleanupOldUpdates', () => {
    it('should delete updates older than the specified days', async () => {
      // Setup
      const documentId = 'test-doc';
      const olderThanDays = 30;
      const mockSupabase = require('../config/supabase').supabase;
      
      mockSupabase.from().delete().eq().lt.mockResolvedValue({ error: null });
      
      // Test
      const result = await yjsService.cleanupOldUpdates(documentId, olderThanDays);
      
      // Assertions
      expect(mockSupabase.from).toHaveBeenCalledWith('yjs_updates');
      expect(mockSupabase.from().delete().eq().lt).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
  
  describe('compressContent and decompressContent', () => {
    it('should compress content if it exceeds threshold', async () => {
      // Create an array larger than the threshold
      const largeArray = new Uint8Array(2000);
      
      // Test
      const result = await yjsService.compressContent(largeArray);
      
      // Assertions
      expect(result.compressed).toBe(true);
      expect(result.data).toBeDefined();
    });
    
    it('should decompress compressed content', async () => {
      // Setup
      const content = new Uint8Array([1, 2, 3]);
      const isCompressed = true;
      
      // Test
      const result = await yjsService.decompressContent(content, isCompressed);
      
      // Assertions
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
}); 