/**
 * Factory for creating canvas objects with flexible configuration
 */
interface Node {
  id: string;
  data: any;
  position: { x: number; y: number };
}

interface Edge {
  id: string;
  source: string;
  target: string;
}

interface Canvas {
  id: string;
  name: string;
  createdBy: string;
  nodes: Node[];
  edges: Edge[];
}

export class CanvasFactory {
  private canvas: Canvas = {
    id: `canvas-${Math.random().toString(36).substring(2, 9)}`,
    name: 'Test Canvas',
    createdBy: 'user-1',
    nodes: [],
    edges: [],
  };

  /**
   * Set the canvas ID
   */
  withId(id: string): CanvasFactory {
    this.canvas.id = id;
    return this;
  }

  /**
   * Set the canvas name
   */
  withName(name: string): CanvasFactory {
    this.canvas.name = name;
    return this;
  }

  /**
   * Set the creator ID
   */
  withCreator(userId: string): CanvasFactory {
    this.canvas.createdBy = userId;
    return this;
  }

  /**
   * Add a node to the canvas
   */
  withNode(nodeData: Partial<Node>): CanvasFactory {
    const {
      id = `node-${this.canvas.nodes.length + 1}`,
      data = {},
      position = { x: 0, y: 0 },
    } = nodeData;

    this.canvas.nodes.push({
      id,
      data,
      position,
    });

    return this;
  }

  /**
   * Add multiple nodes to the canvas
   */
  withNodes(
    count: number,
    generator?: (index: number) => Partial<Node>
  ): CanvasFactory {
    const defaultGenerator = (i: number) => ({
      id: `node-${this.canvas.nodes.length + i + 1}`,
      data: { content: `Node ${this.canvas.nodes.length + i + 1}` },
      position: { x: i * 100, y: i * 100 },
    });

    const nodeGenerator = generator || defaultGenerator;

    for (let i = 0; i < count; i++) {
      const node = nodeGenerator(i);
      this.canvas.nodes.push({
        id: node.id || `node-${this.canvas.nodes.length + i + 1}`,
        data: node.data || {},
        position: node.position || { x: 0, y: 0 },
      });
    }

    return this;
  }

  /**
   * Add an edge between nodes
   */
  withEdge(edgeData: Partial<Edge>): CanvasFactory {
    const {
      id = `edge-${this.canvas.edges.length + 1}`,
      source,
      target,
    } = edgeData;

    if (source && target) {
      this.canvas.edges.push({
        id,
        source,
        target,
      });
    }

    return this;
  }

  /**
   * Connect all nodes sequentially
   */
  withConnectedNodes(): CanvasFactory {
    if (this.canvas.nodes.length < 2) {
      return this;
    }

    for (let i = 0; i < this.canvas.nodes.length - 1; i++) {
      this.canvas.edges.push({
        id: `edge-${this.canvas.edges.length + 1}`,
        source: this.canvas.nodes[i].id,
        target: this.canvas.nodes[i + 1].id,
      });
    }

    return this;
  }

  /**
   * Build and return the canvas object
   */
  build(): Canvas {
    return { ...this.canvas };
  }
}
