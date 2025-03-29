/**
 * Generator function for canvas data for testing
 */
export const generateCanvas = (options: any = {}) => {
  const {
    id = `canvas-${Math.random().toString(36).substring(2, 9)}`,
    name = `Canvas ${Math.floor(Math.random() * 1000)}`,
    createdBy = 'user-1',
    nodeCount = 5,
    edgeCount = 3,
  } = options;

  // Generate nodes
  const nodes = Array(nodeCount)
    .fill(null)
    .map((_, i) => ({
      id: `node-${i + 1}`,
      data: { content: `Generated Node ${i + 1}` },
      position: {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      },
    }));

  // Generate edges (if nodes exist)
  const edges =
    nodeCount > 1
      ? Array(Math.min(edgeCount, nodeCount - 1))
          .fill(null)
          .map((_, i) => ({
            id: `edge-${i + 1}`,
            source: `node-${i + 1}`,
            target: `node-${((i + 1) % nodeCount) + 1}`,
          }))
      : [];

  return {
    id,
    name,
    createdBy,
    nodes,
    edges,
  };
};
