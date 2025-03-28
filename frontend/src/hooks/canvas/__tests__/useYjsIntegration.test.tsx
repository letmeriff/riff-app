import { renderHook, act } from '@testing-library/react';
import { useYjsIntegration } from '../useYjsIntegration';
import { useYjs } from '../../../contexts/YjsContext';

// Mock dependencies
jest.mock('../../../contexts/YjsContext', () => ({
  useYjs: jest.fn(),
}));

describe('useYjsIntegration', () => {
  const mockIsConnected = jest.fn();
  const mockGetAwarenessInfo = jest.fn();
  const mockUpdateAwareness = jest.fn();
  const mockGetOfflineChanges = jest.fn();
  const mockForceSync = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    (useYjs as jest.Mock).mockReturnValue({
      isConnected: true,
      ydoc: {},
      provider: { awareness: {} },
      getAwarenessInfo: mockGetAwarenessInfo.mockReturnValue([]),
      updateAwareness: mockUpdateAwareness,
      getOfflineChanges: mockGetOfflineChanges.mockReturnValue([]),
      forceSync: mockForceSync.mockResolvedValue(true),
    });
    
    mockIsConnected.mockReturnValue(true);
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useYjsIntegration());
    
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.offlineChangesCount).toBe(0);
    expect(result.current.syncStatus).toBe(null);
    expect(result.current.connectedUsers).toEqual([]);
  });

  it('should detect offline status', () => {
    (useYjs as jest.Mock).mockReturnValue({
      isConnected: false,
      ydoc: {},
      provider: { awareness: {} },
      getAwarenessInfo: mockGetAwarenessInfo.mockReturnValue([]),
      updateAwareness: mockUpdateAwareness,
      getOfflineChanges: mockGetOfflineChanges.mockReturnValue([
        { type: 'update', data: new Uint8Array([1, 2, 3]) }
      ]),
      forceSync: mockForceSync.mockResolvedValue(true),
    });
    
    const { result } = renderHook(() => useYjsIntegration());
    
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isOffline).toBe(true);
    expect(result.current.offlineChangesCount).toBe(1);
  });

  it('should provide connected users', () => {
    const mockUsers = [
      { id: 'user1', name: 'User 1', color: '#ff0000' },
      { id: 'user2', name: 'User 2', color: '#00ff00' },
    ];
    
    mockGetAwarenessInfo.mockReturnValue(mockUsers);
    
    const { result } = renderHook(() => useYjsIntegration());
    
    expect(result.current.connectedUsers).toEqual(mockUsers);
  });

  it('should update awareness', () => {
    const { result } = renderHook(() => useYjsIntegration());
    
    act(() => {
      result.current.updateAwareness({ cursor: { x: 100, y: 100 } });
    });
    
    expect(mockUpdateAwareness).toHaveBeenCalledWith({ cursor: { x: 100, y: 100 } });
  });

  it('should force sync when requested', async () => {
    const { result } = renderHook(() => useYjsIntegration());
    
    await act(async () => {
      const success = await result.current.forceSync();
      expect(success).toBe(true);
    });
    
    expect(mockForceSync).toHaveBeenCalled();
  });

  it('should handle sync failure', async () => {
    mockForceSync.mockRejectedValue(new Error('Sync failed'));
    
    const { result } = renderHook(() => useYjsIntegration());
    
    let syncSuccess = false;
    
    await act(async () => {
      try {
        syncSuccess = await result.current.forceSync();
      } catch (error) {
        // Error should be caught inside the hook
      }
    });
    
    expect(syncSuccess).toBe(false);
    expect(result.current.syncStatus).toContain('Error');
  });

  it('should update sync status during operations', async () => {
    const { result } = renderHook(() => useYjsIntegration());
    
    await act(async () => {
      // Start sync
      const syncPromise = result.current.forceSync();
      
      // Check status during sync
      expect(result.current.syncStatus).toBe('Syncing');
      
      await syncPromise;
      
      // Status should update after sync
      expect(result.current.syncStatus).toBe('Synced');
    });
  });
}); 