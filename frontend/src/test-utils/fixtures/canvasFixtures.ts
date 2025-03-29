/**
 * Test fixtures for canvas data
 */
export const sampleCanvas = {
  id: 'canvas-1',
  name: 'Test Canvas',
  createdBy: 'user-1',
  nodes: [
    {
      id: 'node-1',
      data: { content: 'Node 1 Content' },
      position: { x: 100, y: 100 },
    },
    {
      id: 'node-2',
      data: { content: 'Node 2 Content' },
      position: { x: 300, y: 200 },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
    },
  ],
};

export const emptyCanvas = {
  id: 'canvas-2',
  name: 'Empty Canvas',
  createdBy: 'user-1',
  nodes: [],
  edges: [],
};

export const largeCanvas = {
  id: 'canvas-3',
  name: 'Large Canvas',
  createdBy: 'user-1',
  nodes: Array(100)
    .fill(null)
    .map((_, i) => ({
      id: `node-${i + 1}`,
      data: { content: `Node ${i + 1} Content` },
      position: { x: (i % 10) * 200, y: Math.floor(i / 10) * 200 },
    })),
  edges: Array(50)
    .fill(null)
    .map((_, i) => ({
      id: `edge-${i + 1}`,
      source: `node-${i + 1}`,
      target: `node-${((i + 1) % 100) + 1}`,
    })),
};
