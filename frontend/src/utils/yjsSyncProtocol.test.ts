import * as Y from 'yjs';
import {
  getDocumentStateVector,
  needsSynchronization,
  createDifferentialUpdate,
  getTimestampVector,
} from './yjsSyncProtocol';

// Mock Y namespace functions
jest.mock('yjs', () => ({
  encodeStateVector: jest.fn(),
  encodeStateAsUpdate: jest.fn(),
  Doc: jest.fn().mockImplementation(() => ({
    // Mock implementation for Y.Doc
  })),
}));

describe('yjsSyncProtocol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDocumentStateVector', () => {
    it('should call encodeStateVector with the document', () => {
      // Setup
      const mockDoc = new Y.Doc();
      const mockStateVector = new Uint8Array([1, 2, 3]);
      (Y.encodeStateVector as jest.Mock).mockReturnValue(mockStateVector);

      // Execute
      const result = getDocumentStateVector(mockDoc);

      // Verify
      expect(Y.encodeStateVector).toHaveBeenCalledWith(mockDoc);
      expect(result).toBe(mockStateVector);
    });
  });

  describe('needsSynchronization', () => {
    it('should return true when there are differences between documents', () => {
      // Setup
      const mockDoc = new Y.Doc();
      const mockRemoteVector = new Uint8Array([1, 2, 3]);
      const mockDiffUpdate = new Uint8Array([4, 5, 6]); // Non-empty update means there are differences
      (Y.encodeStateAsUpdate as jest.Mock).mockReturnValue(mockDiffUpdate);

      // Execute
      const result = needsSynchronization(mockDoc, mockRemoteVector);

      // Verify
      expect(Y.encodeStateAsUpdate).toHaveBeenCalledWith(
        mockDoc,
        mockRemoteVector
      );
      expect(result).toBe(true);
    });

    it('should return false when documents are in sync', () => {
      // Setup
      const mockDoc = new Y.Doc();
      const mockRemoteVector = new Uint8Array([1, 2, 3]);
      const mockEmptyDiffUpdate = new Uint8Array([]); // Empty update means documents are in sync
      (Y.encodeStateAsUpdate as jest.Mock).mockReturnValue(mockEmptyDiffUpdate);

      // Execute
      const result = needsSynchronization(mockDoc, mockRemoteVector);

      // Verify
      expect(Y.encodeStateAsUpdate).toHaveBeenCalledWith(
        mockDoc,
        mockRemoteVector
      );
      expect(result).toBe(false);
    });
  });

  describe('createDifferentialUpdate', () => {
    it('should call encodeStateAsUpdate with the document and remote state vector', () => {
      // Setup
      const mockDoc = new Y.Doc();
      const mockRemoteVector = new Uint8Array([1, 2, 3]);
      const mockDiffUpdate = new Uint8Array([4, 5, 6]);
      (Y.encodeStateAsUpdate as jest.Mock).mockReturnValue(mockDiffUpdate);

      // Execute
      const result = createDifferentialUpdate(mockDoc, mockRemoteVector);

      // Verify
      expect(Y.encodeStateAsUpdate).toHaveBeenCalledWith(
        mockDoc,
        mockRemoteVector
      );
      expect(result).toBe(mockDiffUpdate);
    });
  });

  describe('getTimestampVector', () => {
    it('should return a timestamp that increases over time', () => {
      // Setup
      const originalDateNow = Date.now;
      let mockTime = 1000;
      Date.now = jest.fn().mockImplementation(() => mockTime);

      // Execute
      const ts1 = getTimestampVector();
      mockTime += 10;
      const ts2 = getTimestampVector();

      // Cleanup
      Date.now = originalDateNow;

      // Verify
      expect(ts1).toBe(1000);
      expect(ts2).toBe(1010);
      expect(ts2).toBeGreaterThan(ts1);
    });
  });
});
