import * as Y from 'yjs';
import {
  getYjsDocument,
  storeYjsDocument,
  storeYjsUpdate,
  getYjsUpdates,
  cleanupOldUpdates,
  compressContent,
  decompressContent,
  getLatestDocumentVersion,
  recoverDocumentFromUpdates
} from './yjsService';
import { supabase } from '../config/supabase';
// Import zlib for use in the util mock
import * as zlib from 'zlib';

// Mock external dependencies
jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    rpc: jest.fn().mockReturnThis(),
    single: jest.fn(),
    then: jest.fn()
  }
}));

// Mock zlib methods
const mockGzip = jest.fn();
const mockGunzip = jest.fn();
jest.mock('zlib', () => ({
  gzip: jest.fn(),
  gunzip: jest.fn()
}));
jest.mock('util', () => ({
  promisify: jest.fn((fn) => {
    if (fn === zlib.gzip) return mockGzip;
    if (fn === zlib.gunzip) return mockGunzip;
    return jest.fn();
  })
}));

// More complete YJS mock
jest.mock('yjs', () => {
  const mockDoc = {
    getText: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('test content'),
    }),
    toJSON: jest.fn().mockReturnValue({ text: 'test content' }),
    getMap: jest.fn(() => ({
      set: jest.fn(),
      get: jest.fn().mockReturnValue({ toString: () => 'test' }),
      toJSON: jest.fn().mockReturnValue({ key: 'value' }),
    })),
    getArray: jest.fn(() => ({
      push: jest.fn(),
      insert: jest.fn(),
      toJSON: jest.fn().mockReturnValue(['item1', 'item2']),
    })),
    on: jest.fn(),
    off: jest.fn(),
    transact: jest.fn((fn) => fn()),
    destroy: jest.fn(),
    clientID: 1,
  };
  
  return {
    Doc: jest.fn().mockImplementation(() => ({
      ...mockDoc,
      encodeStateAsUpdate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    })),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
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
      
      // Properly mock the chained methods for document check and insertion
      const mockSelectSingle = {
        data: null,
        error: null
      };
      
      const mockInsertResult = {
        data: { id: 'db-doc-id' },
        error: null
      };
      
      (supabase.from as jest.Mock)().select().single.mockResolvedValue(mockSelectSingle);
      (supabase.from as jest.Mock)().insert().mockResolvedValue(mockInsertResult);
      
      // Test
      const result = await storeYjsDocument(documentId, documentState, version);
      
      // Assertions
      expect(result).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('yjs_documents');
      expect((supabase.from as jest.Mock)().insert).toHaveBeenCalled();
    });
    
    it('should handle database errors gracefully', async () => {
      // Setup
      const documentId = 'test-doc';
      const version = 1;
      const documentState = new Uint8Array([1, 2, 3]);
      
      // Properly mock the chained methods
      (supabase.from as jest.Mock)().select().single.mockResolvedValue({ data: null, error: null });
      (supabase.from as jest.Mock)().insert().mockResolvedValue({ 
        data: null,
        error: { message: 'Database error' } 
      });
      
      // Test
      const result = await storeYjsDocument(documentId, documentState, version);
      
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
      
      // Properly mock the chained methods
      (supabase.from as jest.Mock)().select().eq().single.mockResolvedValue({
        data: mockData,
        error: null,
      });
      
      // Test
      const result = await getYjsDocument(documentId);
      
      // Assertions
      expect(supabase.from).toHaveBeenCalledWith('yjs_documents');
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });
    
    it('should return null if no document exists and recovery fails', async () => {
      // Setup
      const documentId = 'test-doc';
      
      // Mock document not found
      (supabase.from as jest.Mock)().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Not found' } 
      });
      
      // Mock recovery failure - empty updates list
      (supabase.from as jest.Mock)().select().eq().order().mockResolvedValue({
        data: [],
        error: null
      });
      
      // Test
      const result = await getYjsDocument(documentId);
      
      // Assertions
      expect(result).toBeNull();
      expect(supabase.from).toHaveBeenNthCalledWith(1, 'yjs_documents');
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'yjs_updates');
    });
  });
  
  describe('storeYjsUpdate', () => {
    it('should store an update in the database', async () => {
      // Setup
      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3]);
      const clientId = 'client1';
      const version = 10;
      
      (supabase.from as jest.Mock)().insert().mockResolvedValue({ 
        data: { id: 'new-update-id' },
        error: null 
      });
      
      // Test
      const result = await storeYjsUpdate(documentId, update, clientId, version);
      
      // Assertions
      expect(result).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('yjs_updates');
      expect((supabase.from as jest.Mock)().insert).toHaveBeenCalled();
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
      
      (supabase.from as jest.Mock)().select().eq().order().gt.mockResolvedValue({
        data: mockData,
        error: null,
      });
      
      // Test
      const result = await getYjsUpdates(documentId, fromVersion);
      
      // Assertions
      expect(supabase.from).toHaveBeenCalledWith('yjs_updates');
      expect((supabase.from as jest.Mock)().eq).toHaveBeenCalledWith('document_id', documentId);
      expect((supabase.from as jest.Mock)().select().eq().order().gt).toHaveBeenCalledWith('version', fromVersion);
      expect(result.length).toBe(2);
      expect(result[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(result[1]).toEqual(new Uint8Array([4, 5, 6]));
    });
  });
  
  describe('recoverDocumentFromUpdates', () => {
    it('should recover a document from updates', async () => {
      // Setup
      const documentId = 'test-doc';
      
      // Set up mock data for getYjsUpdates
      (supabase.from as jest.Mock)().select().eq().order().mockResolvedValue({
        data: [
          { update: new Uint8Array([1, 2, 3]), is_compressed: false },
          { update: new Uint8Array([4, 5, 6]), is_compressed: false }
        ],
        error: null
      });
      
      // Test
      const result = await recoverDocumentFromUpdates(documentId);
      
      // Assertions
      expect(supabase.from).toHaveBeenCalledWith('yjs_updates');
      expect(Y.applyUpdate).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
    });
    
    it('should return null if no updates exist', async () => {
      // Setup
      const documentId = 'test-doc';
      
      // Set up mock data for getYjsUpdates
      (supabase.from as jest.Mock)().select().eq().order().mockResolvedValue({
        data: [],
        error: null
      });
      
      // Test
      const result = await recoverDocumentFromUpdates(documentId);
      
      // Assertions
      expect(result).toBeNull();
    });
  });
  
  describe('getLatestDocumentVersion', () => {
    it('should return the latest version from document', async () => {
      const documentId = 'test-doc-1';
      
      // Mock Supabase query for document version
      (supabase.from as jest.Mock).mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { version: 10 },
          error: null
        })
      }));

      const result = await getLatestDocumentVersion(documentId);

      // Verify Supabase was called correctly
      expect(supabase.from).toHaveBeenCalledWith('yjs_documents');
      expect((supabase.from as jest.Mock)().select).toHaveBeenCalledWith('version');
      expect((supabase.from as jest.Mock)().select().eq).toHaveBeenCalledWith('document_id', documentId);

      // Verify correct version returned
      expect(result).toBe(10);
    });
  });
  
  describe('cleanupOldUpdates', () => {
    it('should delete updates older than the specified days', async () => {
      // Setup
      const documentId = 'test-doc';
      const olderThanDays = 30;
      
      (supabase.from as jest.Mock)().delete().eq().lt.mockResolvedValue({ error: null });
      
      // Test
      const result = await cleanupOldUpdates(documentId, olderThanDays);
      
      // Assertions
      expect(supabase.from).toHaveBeenCalledWith('yjs_updates');
      expect((supabase.from as jest.Mock)().delete().eq().lt).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
  
  describe('compressContent and decompressContent', () => {
    it('should compress content if it exceeds threshold', async () => {
      // Create an array larger than the threshold
      const largeArray = new Uint8Array(2000);
      
      // Test
      const result = await compressContent(largeArray);
      
      // Assertions
      expect(result.compressed).toBe(true);
      expect(result.data).toBeDefined();
    });
    
    it('should decompress compressed content', async () => {
      // Setup
      const content = new Uint8Array([1, 2, 3]);
      const isCompressed = true;
      
      // Test
      const result = await decompressContent(content, isCompressed);
      
      // Assertions
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
}); 