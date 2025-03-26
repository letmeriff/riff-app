import * as Y from 'yjs';
import { Pool } from 'pg';
import * as yjsService from './yjsService';

// Mock dependencies
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

jest.mock('yjs', () => {
  return {
    Doc: jest.fn().mockImplementation(() => ({
      encodeStateAsUpdate: jest.fn(),
    })),
    encodeStateAsUpdate: jest.fn(),
    applyUpdate: jest.fn(),
  };
});

describe('yjsService', () => {
  let mockPool: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = (Pool as jest.Mock)();
  });
  
  describe('saveDocumentSnapshot', () => {
    it('should save document snapshot to database', async () => {
      // Setup
      const documentId = 'test-doc';
      const version = 1;
      const doc = new Y.Doc();
      const encodedState = new Uint8Array([1, 2, 3]);
      
      (doc.encodeStateAsUpdate as jest.Mock).mockReturnValue(encodedState);
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });
      
      // Test
      await yjsService.saveDocumentSnapshot(documentId, doc, version);
      
      // Assertions
      expect(doc.encodeStateAsUpdate).toHaveBeenCalled();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO yjs_documents'),
        expect.arrayContaining([documentId, expect.any(Buffer), version])
      );
    });
    
    it('should handle database errors gracefully', async () => {
      // Setup
      const documentId = 'test-doc';
      const version = 1;
      const doc = new Y.Doc();
      
      mockPool.query.mockRejectedValue(new Error('Database error'));
      
      // Test & assertions
      await expect(yjsService.saveDocumentSnapshot(documentId, doc, version))
        .rejects.toThrow('Failed to save document snapshot');
    });
  });
  
  describe('getLatestDocumentSnapshot', () => {
    it('should retrieve the latest document snapshot', async () => {
      // Setup
      const documentId = 'test-doc';
      const mockSnapshot = {
        document_content: Buffer.from([1, 2, 3]),
        version: 5,
      };
      
      mockPool.query.mockResolvedValue({
        rows: [mockSnapshot],
      });
      
      // Test
      const result = await yjsService.getLatestDocumentSnapshot(documentId);
      
      // Assertions
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM yjs_documents'),
        [documentId]
      );
      expect(result).toEqual({
        content: new Uint8Array([1, 2, 3]),
        version: 5,
      });
    });
    
    it('should return null if no snapshot exists', async () => {
      // Setup
      const documentId = 'test-doc';
      mockPool.query.mockResolvedValue({ rows: [] });
      
      // Test
      const result = await yjsService.getLatestDocumentSnapshot(documentId);
      
      // Assertions
      expect(result).toBeNull();
    });
  });
  
  describe('storeUpdate', () => {
    it('should store an update in the database', async () => {
      // Setup
      const documentId = 'test-doc';
      const update = new Uint8Array([1, 2, 3]);
      const clientId = 'client1';
      const version = 10;
      
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      
      // Test
      await yjsService.storeUpdate(documentId, update, clientId, version);
      
      // Assertions
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO yjs_updates'),
        expect.arrayContaining([documentId, expect.any(Buffer), clientId, version])
      );
    });
  });
  
  describe('getUpdatesAfterVersion', () => {
    it('should retrieve updates after a specific version', async () => {
      // Setup
      const documentId = 'test-doc';
      const version = 5;
      const mockUpdates = [
        { update_content: Buffer.from([1, 2, 3]), version: 6 },
        { update_content: Buffer.from([4, 5, 6]), version: 7 },
      ];
      
      mockPool.query.mockResolvedValue({
        rows: mockUpdates,
      });
      
      // Test
      const result = await yjsService.getUpdatesAfterVersion(documentId, version);
      
      // Assertions
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM yjs_updates'),
        [documentId, version]
      );
      expect(result).toEqual([
        { update: new Uint8Array([1, 2, 3]), version: 6 },
        { update: new Uint8Array([4, 5, 6]), version: 7 },
      ]);
    });
  });
  
  describe('rebuildDocumentFromUpdates', () => {
    it('should rebuild a document from snapshot and updates', async () => {
      // Setup
      const documentId = 'test-doc';
      const mockSnapshot = {
        content: new Uint8Array([1, 2, 3]),
        version: 5,
      };
      
      const mockUpdates = [
        { update: new Uint8Array([4, 5, 6]), version: 6 },
        { update: new Uint8Array([7, 8, 9]), version: 7 },
      ];
      
      jest.spyOn(yjsService, 'getLatestDocumentSnapshot').mockResolvedValue(mockSnapshot);
      jest.spyOn(yjsService, 'getUpdatesAfterVersion').mockResolvedValue(mockUpdates);
      
      // Test
      const result = await yjsService.rebuildDocumentFromUpdates(documentId);
      
      // Assertions
      expect(yjsService.getLatestDocumentSnapshot).toHaveBeenCalledWith(documentId);
      expect(yjsService.getUpdatesAfterVersion).toHaveBeenCalledWith(documentId, 5);
      expect(Y.applyUpdate).toHaveBeenCalledTimes(3);
      expect(result.doc).toBeInstanceOf(Y.Doc);
      expect(result.version).toBe(7);
    });
    
    it('should create a new document if no snapshot exists', async () => {
      // Setup
      const documentId = 'test-doc';
      
      jest.spyOn(yjsService, 'getLatestDocumentSnapshot').mockResolvedValue(null);
      jest.spyOn(yjsService, 'getUpdatesAfterVersion').mockResolvedValue([]);
      
      // Test
      const result = await yjsService.rebuildDocumentFromUpdates(documentId);
      
      // Assertions
      expect(Y.Doc).toHaveBeenCalled();
      expect(result.doc).toBeInstanceOf(Y.Doc);
      expect(result.version).toBe(0);
    });
  });
  
  describe('cleanupOldUpdates', () => {
    it('should delete updates older than the provided version', async () => {
      // Setup
      const documentId = 'test-doc';
      const version = 10;
      
      mockPool.query.mockResolvedValue({ rowCount: 5 });
      
      // Test
      const result = await yjsService.cleanupOldUpdates(documentId, version);
      
      // Assertions
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM yjs_updates'),
        [documentId, version]
      );
      expect(result).toBe(5);
    });
  });
}); 