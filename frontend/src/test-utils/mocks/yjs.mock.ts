// Create a more robust mock document
const createMockMap = () => {
  const mapData = new Map<string, unknown>();
  return {
    set: jest.fn((key: string, value: unknown) => mapData.set(key, value)),
    get: jest.fn((key: string) => mapData.get(key)),
    delete: jest.fn((key: string) => mapData.delete(key)),
    has: jest.fn((key: string) => mapData.has(key)),
    forEach: jest.fn((callback: (value: unknown, key: string) => void) => mapData.forEach(callback)),
    observe: jest.fn((_callback: (event: unknown) => void) => ({ unobserve: jest.fn() })),
    unobserve: jest.fn(),
    toJSON: jest.fn(() => {
      const obj: Record<string, unknown> = {};
      mapData.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }),
  };
};

const createMockArray = () => {
  const arrayData: unknown[] = [];
  return {
    push: jest.fn((value: unknown) => arrayData.push(value)),
    delete: jest.fn((index: number) => arrayData.splice(index, 1)),
    get: jest.fn((index: number) => arrayData[index]),
    length: jest.fn(() => arrayData.length),
    toArray: jest.fn(() => [...arrayData]),
    observe: jest.fn(() => ({ unobserve: jest.fn() })),
    unobserve: jest.fn(),
  };
};

export const mockMap = createMockMap();
export const mockArray = createMockArray();

// Define the type for the mock document to match the expected structure
export interface MockYjsDoc {
  on: jest.Mock;
  off: jest.Mock;
  clientID: number;
  getMap: jest.Mock;
  getArray: jest.Mock;
  getText: jest.Mock;
  transact: jest.Mock;
  destroy: jest.Mock;
  encodeStateAsUpdate: jest.Mock;
}

export const mockDoc: MockYjsDoc = {
  on: jest.fn(),
  off: jest.fn(),
  clientID: 1,
  getMap: jest.fn(() => mockMap),
  getArray: jest.fn(() => mockArray),
  getText: jest.fn(),
  transact: jest.fn((fn: () => void) => fn()),
  destroy: jest.fn(),
  encodeStateAsUpdate: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
};

// Define the type for awareness state
export interface AwarenessState {
  user: {
    name: string;
    id: string;
  };
  cursor: {
    x: number;
    y: number;
  };
}

export const mockAwareness = {
  setLocalState: jest.fn(),
  getLocalState: jest.fn(() => ({ user: { name: 'Test User', id: 'user1' }, cursor: { x: 0, y: 0 } })),
  on: jest.fn(),
  off: jest.fn(),
  getStates: jest.fn(() => new Map([
    [1, { user: { name: 'Test User', id: 'user1' }, cursor: { x: 0, y: 0 } }]
  ])),
};

export const mockWebsocketProvider = {
  awareness: mockAwareness,
  on: jest.fn(),
  off: jest.fn(),
  wsconnected: true,
  connect: jest.fn(),
  disconnect: jest.fn(),
};

export const mockIndexeddbPersistence = {
  on: jest.fn(),
  off: jest.fn(),
  destroy: jest.fn(),
  whenSynced: jest.fn().mockResolvedValue(true),
};

// Set up mocks
jest.mock('yjs', () => ({
  Doc: jest.fn(() => mockDoc),
  Map: jest.fn(() => createMockMap()),
  Array: jest.fn(() => createMockArray()),
  applyUpdate: jest.fn(),
  encodeStateAsUpdate: jest.fn(() => new Uint8Array([1, 2, 3])),
}));

jest.mock('y-websocket', () => ({
  WebsocketProvider: jest.fn(() => mockWebsocketProvider),
}));

jest.mock('y-indexeddb', () => ({
  IndexeddbPersistence: jest.fn(() => mockIndexeddbPersistence),
})); 