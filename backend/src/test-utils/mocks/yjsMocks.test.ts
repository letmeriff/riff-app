import * as Y from 'yjs';
import {
  mockDoc,
  mockAwareness,
  mockUpdate,
  mockTransactionEvent,
  mockAwarenessEvent,
  createMockYjsProvider,
  mockSyncStep1,
  mockSyncStep2,
  MockYjsProvider
} from './yjsMocks';

describe('Yjs Mocks', () => {
  describe('mockDoc', () => {
    test('should create a mock Y.Doc instance with standard methods', () => {
      const doc = mockDoc();
      
      expect(doc).toBeDefined();
      expect(doc.getMap).toBeDefined();
      expect(doc.getText).toBeDefined();
      expect(doc.getArray).toBeDefined();
      expect(doc.on).toBeDefined();
      expect(doc.transact).toBeDefined();
      expect(doc.clientID).toBeDefined();
    });
    
    test('should emit update events when specified', () => {
      const updateHandler = jest.fn();
      const doc = mockDoc();
      
      doc.on('update', updateHandler);
      
      // Simulate an update
      const update = new Uint8Array([1, 2, 3]);
      doc.emit('update', [update, 'origin']);
      
      expect(updateHandler).toHaveBeenCalledWith(update, 'origin');
    });
    
    test('should allow interaction with mock maps', () => {
      const doc = mockDoc();
      const map = doc.getMap('testMap');
      
      map.set('key1', 'value1');
      
      expect(map.get('key1')).toBe('value1');
    });
    
    test('should allow interaction with mock text', () => {
      const doc = mockDoc();
      const text = doc.getText('testText');
      
      text.insert(0, 'Hello, world!');
      
      expect(text.toString()).toBe('Hello, world!');
    });
  });
  
  describe('mockAwareness', () => {
    test('should create a mock awareness instance with standard methods', () => {
      const doc = mockDoc();
      const awareness = mockAwareness(doc);
      
      expect(awareness).toBeDefined();
      expect(awareness.setLocalState).toBeDefined();
      expect(awareness.getLocalState).toBeDefined();
      expect(awareness.getStates).toBeDefined();
      expect(awareness.on).toBeDefined();
    });
    
    test('should emit change events when the state changes', () => {
      const doc = mockDoc();
      const awareness = mockAwareness(doc);
      const changeHandler = jest.fn();
      
      awareness.on('change', changeHandler);
      
      // Set local state
      awareness.setLocalState({ user: { id: 'test-user', name: 'Test User' } });
      
      expect(changeHandler).toHaveBeenCalled();
      expect(awareness.getLocalState()).toEqual({ user: { id: 'test-user', name: 'Test User' } });
    });
    
    test('should track multiple client states', () => {
      const doc = mockDoc();
      const awareness = mockAwareness(doc);
      
      // Set states for different clients
      awareness.setClientState(1, { user: { id: 'user-1' } });
      awareness.setClientState(2, { user: { id: 'user-2' } });
      
      const states = awareness.getStates();
      
      expect(states.get(1)).toEqual({ user: { id: 'user-1' } });
      expect(states.get(2)).toEqual({ user: { id: 'user-2' } });
    });
  });
  
  describe('mockUpdate', () => {
    test('should generate a mock Yjs update', () => {
      const update = mockUpdate();
      
      expect(update).toBeInstanceOf(Uint8Array);
      expect(update.length).toBeGreaterThan(0);
    });
  });
  
  describe('mockTransactionEvent and mockAwarenessEvent', () => {
    test('should create a mock transaction event', () => {
      const doc = mockDoc();
      const event = mockTransactionEvent(doc);
      
      expect(event).toBeDefined();
      expect(event.currentTarget).toBe(doc);
      expect(event.transaction).toBeDefined();
    });
    
    test('should create a mock awareness event', () => {
      const doc = mockDoc();
      const awareness = mockAwareness(doc);
      const event = mockAwarenessEvent(awareness);
      
      expect(event).toBeDefined();
      expect(event.currentTarget).toBe(awareness);
      expect(event.added).toBeDefined();
      expect(event.updated).toBeDefined();
      expect(event.removed).toBeDefined();
    });
  });
  
  describe('mockSyncStep1 and mockSyncStep2', () => {
    test('should generate sync step 1 message', () => {
      const message = mockSyncStep1();
      
      expect(message).toBeInstanceOf(Uint8Array);
      expect(message.length).toBeGreaterThan(0);
    });
    
    test('should generate sync step 2 message', () => {
      const message = mockSyncStep2();
      
      expect(message).toBeInstanceOf(Uint8Array);
      expect(message.length).toBeGreaterThan(0);
    });
  });
  
  describe('createMockYjsProvider', () => {
    test('should create a mock YjsProvider with expected methods', () => {
      const provider = createMockYjsProvider();
      
      expect(provider).toBeDefined();
      expect(provider.connect).toBeDefined();
      expect(provider.disconnect).toBeDefined();
      expect(provider.isConnected).toBeDefined();
      expect(provider.on).toBeDefined();
      expect(provider.off).toBeDefined();
      expect(provider.emit).toBeDefined();
    });
    
    test('should handle connect/disconnect state changes', () => {
      const provider = createMockYjsProvider();
      const connectHandler = jest.fn();
      const disconnectHandler = jest.fn();
      
      provider.on('connect', connectHandler);
      provider.on('disconnect', disconnectHandler);
      
      expect(provider.isConnected()).toBe(false);
      
      provider.connect();
      expect(provider.isConnected()).toBe(true);
      expect(connectHandler).toHaveBeenCalled();
      
      provider.disconnect();
      expect(provider.isConnected()).toBe(false);
      expect(disconnectHandler).toHaveBeenCalled();
    });
    
    test('should provide awareness functionality', () => {
      const provider = createMockYjsProvider();
      
      expect(provider.awareness).toBeDefined();
      expect(provider.awareness.setLocalState).toBeDefined();
      expect(provider.awareness.getLocalState).toBeDefined();
    });
    
    test('should emit sync events when requested', () => {
      const provider = createMockYjsProvider();
      const syncHandler = jest.fn();
      
      provider.on('sync', syncHandler);
      provider.connect();
      provider.emit('sync', []);
      
      expect(syncHandler).toHaveBeenCalled();
    });
  });
}); 