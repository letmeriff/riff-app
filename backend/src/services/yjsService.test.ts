import * as Y from 'yjs';
import * as yjsService from './yjsService';

// Mock Supabase
jest.mock('../config/supabase', () => {
  // Create a chainable mock function
  const createMockBuilder = () => {
    const mock: any = {};
    
    // Add all chainable methods
    mock.select = jest.fn().mockReturnValue(mock);
    mock.insert = jest.fn().mockReturnValue(mock);
    mock.update = jest.fn().mockReturnValue(mock);
    mock.delete = jest.fn().mockReturnValue(mock);
    mock.eq = jest.fn().mockReturnValue(mock);
    mock.gt = jest.fn().mockReturnValue(mock);
    mock.lt = jest.fn().mockReturnValue(mock);
    mock.order = jest.fn().mockReturnValue(mock);
    mock.single = jest.fn().mockReturnValue(mock);
    
    // Add response handling
    mock.mockReturnValue = jest.fn(value => {
      mock.returnValue = value;
      return mock;
    });
    
    mock.then = jest.fn(cb => 
      Promise.resolve(cb(mock.returnValue || { data: null, error: null }))
    );
    
    return mock;
  };

  return {
    supabase: {
      from: jest.fn().mockImplementation(() => createMockBuilder())
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
      clientID: 1,
      getMap: jest.fn().mockReturnValue({
        set: jest.fn(),
        get: jest.fn(),
        has: jest.fn().mockReturnValue(false)
      }),
      destroy: jest.fn()
    })),
    Map: jest.fn().mockImplementation(() => ({
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    })),
    Array: jest.fn().mockImplementation(() => ({
      push: jest.fn(),
      delete: jest.fn(),
      forEach: jest.fn(),
    })),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  };
});

// Add new test setup with proper mock usage
describe('yjsService', () => {
  let mockSupabase;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get our mock instance
    mockSupabase = require('../config/supabase').supabase;
  });
  
  describe('storeYjsDocument', () => {
    it('should save document to database', async () => {
      // Setup
      const documentId = 'test-doc';
      const version = 1;
      const documentState = new Uint8Array([1, 2, 3]);
      
      // Setup mock responses
      mockSupabase.from().select().single.mockReturnValue({ data: null, error: null });
      mockSupabase.from().insert.mockReturnValue({ data: { id: 1 }, error: null });
      
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
      
      // Setup mock responses
      mockSupabase.from().select().single.mockReturnValue({ data: null, error: null });
      mockSupabase.from().insert.mockReturnValue({ error: new Error('Database error') });
      
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
      
      // Setup mock response
      mockSupabase.from().select().eq().single.mockReturnValue({
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
      
      // Mock document not found
      mockSupabase.from().select().eq().single.mockReturnValue({ 
        data: null, 
        error: 'Not found' 
      });
      
      // Mock recovery failure - empty updates list
      mockSupabase.from().select().eq().order().mockReturnValue({
        data: [],
        error: null
      });
      
      // Test
      const result = await yjsService.getYjsDocument(documentId);
      
      // Assertions
      expect(result).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledWith('yjs_documents');
      expect(mockSupabase.from).toHaveBeenCalledWith('yjs_updates');
    });
  });
  
  describe('storeYjsUpdate', () => {
    it('should store an update in the database', async () => {
      // Setup
      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3]);
      const clientId = 'client1';
      const version = 10;
      
      // Setup mock response
      mockSupabase.from().insert.mockReturnValue({ error: null });
      
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
      
      // Setup mock response
      mockSupabase.from().select().eq().order().gt.mockReturnValue({
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
      
      // Set up mock data for getYjsUpdates
      mockSupabase.from().select().eq().order().mockReturnValue({
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
      
      // Set up mock data for getYjsUpdates
      mockSupabase.from().select().eq().order().mockReturnValue({
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
      
      // Mock existing document check
      mockSupabase.from().select().eq().single.mockReturnValue({ data: null, error: null });
      // Mock successful insert
      mockSupabase.from().insert.mockReturnValue({ error: null });
      
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
      
      mockSupabase.from().delete().eq().lt.mockReturnValue({ error: null });
      
      // Test
      const result = await yjsService.cleanupOldUpdates(documentId, olderThanDays);
      
      // Assertions
      expect(mockSupabase.from).toHaveBeenCalledWith('yjs_updates');
      expect(mockSupabase.from().delete().eq().lt).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
}); 