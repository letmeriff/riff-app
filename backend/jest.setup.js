// Mock out modules with ES import statements
jest.mock('lib0/encoding', () => ({
  createEncoder: jest.fn(() => ({})),
  writeVarUint: jest.fn(),
  writeUint8Array: jest.fn(),
  toUint8Array: jest.fn(() => new Uint8Array([1, 2, 3])),
  length: jest.fn(() => 3),
}));

jest.mock('lib0/decoding', () => ({
  createDecoder: jest.fn(),
  readVarUint: jest.fn(() => 0),
  readUint8Array: jest.fn(() => new Uint8Array([1, 2, 3])),
}));

jest.mock('y-protocols/sync', () => ({
  writeUpdate: jest.fn(),
  writeSyncStep1: jest.fn(),
  writeSyncStep2: jest.fn(),
  readSyncMessage: jest.fn(() => ({ type: 'sync-step-1' })),
}));

jest.mock('y-protocols/awareness', () => ({
  Awareness: jest.fn(() => ({
    on: jest.fn(),
    setLocalState: jest.fn(),
    getStates: jest.fn(() => new Map()),
    destroy: jest.fn(),
  })),
  encodeAwarenessUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
  applyAwarenessUpdate: jest.fn(),
  removeAwarenessStates: jest.fn(),
}));

jest.mock('yjs', () => {
  const mockDoc = {
    on: jest.fn(),
    off: jest.fn(),
    transact: jest.fn((fn) => fn()),
    clientID: 1,
    destroy: jest.fn(),
    encodeStateAsUpdate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  };
  
  return {
    Doc: jest.fn(() => mockDoc),
    applyUpdate: jest.fn(),
    encodeStateAsUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
  };
}); 