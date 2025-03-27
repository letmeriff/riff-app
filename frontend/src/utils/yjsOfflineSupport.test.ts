import {
  getSyncStatus,
  cleanupOfflineSupport
} from './yjsOfflineSupport';

describe('yjsOfflineSupport', () => {
  const documentId = 'test-doc-123';
  
  afterEach(() => {
    // Clean up
    cleanupOfflineSupport(documentId);
  });
  
  describe('getSyncStatus', () => {
    it('should return default status for unknown document', () => {
      // Act
      const status = getSyncStatus('unknown-doc');
      
      // Assert
      expect(status.isOnline).toBe(true);
      expect(status.isConnected).toBe(false);
      expect(status.pendingChanges).toBe(false);
      expect(status.lastSyncedAt).toBeNull();
    });
    
    it('should return expected properties in sync status', () => {
      // Act
      const status = getSyncStatus(documentId);
      
      // Assert
      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('pendingChanges');
      expect(status).toHaveProperty('lastSyncedAt');
      expect(status).toHaveProperty('isReconnecting');
      expect(status).toHaveProperty('reconnectionAttempts');
      expect(status).toHaveProperty('syncInProgress');
    });
  });
}); 