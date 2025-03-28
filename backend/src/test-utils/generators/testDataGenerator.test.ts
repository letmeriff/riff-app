import {
  generateUser,
  generateUserOptions,
  generateCanvas,
  generateCanvasOptions,
  generateNode,
  generateNodeOptions,
  generateEdge,
  generateChatMessage,
  generateChatMessageOptions,
  generateYjsAwareness,
  generateYjsUpdate
} from './testDataGenerator';

describe('Test Data Generator', () => {
  describe('User Generator', () => {
    test('should generate a user with default values', () => {
      const user = generateUser();
      
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('name');
      expect(user.id).toMatch(/^user-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
      expect(user.email).toMatch(/^[a-z0-9]+@example\.com$/);
      expect(user.name).toMatch(/^Test User [A-Z][a-z]+$/);
    });
    
    test('should generate a user with custom values', () => {
      const options: generateUserOptions = {
        id: 'custom-user-id',
        email: 'custom@example.com',
        name: 'Custom User'
      };
      
      const user = generateUser(options);
      
      expect(user.id).toBe('custom-user-id');
      expect(user.email).toBe('custom@example.com');
      expect(user.name).toBe('Custom User');
    });
    
    test('should generate multiple users with unique IDs', () => {
      const users = Array.from({ length: 5 }, () => generateUser());
      const userIds = users.map(user => user.id);
      const uniqueIds = new Set(userIds);
      
      expect(uniqueIds.size).toBe(5);
    });
  });
  
  describe('Node Generator', () => {
    test('should generate a node with default values', () => {
      const node = generateNode();
      
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('type');
      expect(node).toHaveProperty('position');
      expect(node).toHaveProperty('data');
      expect(node.id).toMatch(/^node-[a-f0-9]{8}$/);
      expect(node.position).toHaveProperty('x');
      expect(node.position).toHaveProperty('y');
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    });
    
    test('should generate a node with custom values', () => {
      const options: generateNodeOptions = {
        id: 'custom-node-id',
        type: 'custom-type',
        position: { x: 100, y: 200 },
        data: { content: 'Custom node content', additionalProp: 'value' }
      };
      
      const node = generateNode(options);
      
      expect(node.id).toBe('custom-node-id');
      expect(node.type).toBe('custom-type');
      expect(node.position).toEqual({ x: 100, y: 200 });
      expect(node.data).toEqual({ content: 'Custom node content', additionalProp: 'value' });
    });
  });
  
  describe('Canvas Generator', () => {
    test('should generate a canvas with default values', () => {
      const canvas = generateCanvas();
      
      expect(canvas).toHaveProperty('id');
      expect(canvas).toHaveProperty('name');
      expect(canvas).toHaveProperty('createdBy');
      expect(canvas).toHaveProperty('nodes');
      expect(canvas).toHaveProperty('edges');
      expect(Array.isArray(canvas.nodes)).toBe(true);
      expect(Array.isArray(canvas.edges)).toBe(true);
    });
    
    test('should generate a canvas with custom values', () => {
      const nodes = [generateNode(), generateNode()];
      const edges = [generateEdge({ source: nodes[0].id, target: nodes[1].id })];
      
      const options: generateCanvasOptions = {
        id: 'custom-canvas-id',
        name: 'Custom Canvas',
        createdBy: 'custom-user-id',
        nodes,
        edges
      };
      
      const canvas = generateCanvas(options);
      
      expect(canvas.id).toBe('custom-canvas-id');
      expect(canvas.name).toBe('Custom Canvas');
      expect(canvas.createdBy).toBe('custom-user-id');
      expect(canvas.nodes).toEqual(nodes);
      expect(canvas.edges).toEqual(edges);
    });
  });
  
  describe('Edge Generator', () => {
    test('should generate an edge with required values', () => {
      const source = 'source-node';
      const target = 'target-node';
      
      const edge = generateEdge({ source, target });
      
      expect(edge).toHaveProperty('id');
      expect(edge).toHaveProperty('source');
      expect(edge).toHaveProperty('target');
      expect(edge.id).toMatch(/^edge-[a-f0-9]{8}$/);
      expect(edge.source).toBe(source);
      expect(edge.target).toBe(target);
    });
    
    test('should generate an edge with custom values', () => {
      const options = {
        id: 'custom-edge-id',
        source: 'custom-source',
        target: 'custom-target',
        animated: true,
        label: 'Custom connection'
      };
      
      const edge = generateEdge(options);
      
      expect(edge.id).toBe('custom-edge-id');
      expect(edge.source).toBe('custom-source');
      expect(edge.target).toBe('custom-target');
      expect(edge.animated).toBe(true);
      expect(edge.label).toBe('Custom connection');
    });
  });
  
  describe('Chat Message Generator', () => {
    test('should generate a chat message with default values', () => {
      const message = generateChatMessage();
      
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('nodeId');
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('isUser');
      expect(message).toHaveProperty('timestamp');
      expect(typeof message.isUser).toBe('boolean');
      expect(message.timestamp instanceof Date).toBe(true);
    });
    
    test('should generate a chat message with custom values', () => {
      const options: generateChatMessageOptions = {
        id: 'custom-message-id',
        nodeId: 'custom-node-id',
        content: 'Custom message content',
        isUser: true,
        timestamp: new Date('2023-01-01T00:00:00Z')
      };
      
      const message = generateChatMessage(options);
      
      expect(message.id).toBe('custom-message-id');
      expect(message.nodeId).toBe('custom-node-id');
      expect(message.content).toBe('Custom message content');
      expect(message.isUser).toBe(true);
      expect(message.timestamp).toEqual(new Date('2023-01-01T00:00:00Z'));
    });
  });
  
  describe('Yjs Data Generators', () => {
    test('should generate Yjs awareness data', () => {
      const userId = 'test-user-id';
      const clientId = 1;
      
      const awareness = generateYjsAwareness(userId, clientId);
      
      expect(awareness).toHaveProperty('clientId');
      expect(awareness).toHaveProperty('user');
      expect(awareness.clientId).toBe(clientId);
      expect(awareness.user.id).toBe(userId);
    });
    
    test('should generate a Yjs update', () => {
      const update = generateYjsUpdate();
      
      expect(update instanceof Uint8Array).toBe(true);
      expect(update.length).toBeGreaterThan(0);
    });
  });
}); 