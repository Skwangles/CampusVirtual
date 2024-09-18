import { MinQueue } from 'heapify'
interface Node {
  id: string;
  x: number;
  y: number;
  type: number;
}

interface Edge {
  id0: string;
  id1: string;
}


const getDistance = (point: Node, point2: Node, scaler: number = 1) => {
  // x and y are hi precision decimals between 0 and 1, so make the math a little easier by scaling
  const x = point.x * scaler
  const y = point.y * scaler
  const x2 = point2.x * scaler
  const y2 = point2.y * scaler
  return Math.sqrt(Math.pow(x - x2, 2) + Math.pow(y - y2, 2));
}

const createAdjacencyMatrix = (nodes: Node[], edges: Edge[]) => {
  const size = nodes.length;
  const matrix = Array.from({ length: size }, () => Array(size).fill(Infinity));
  edges.forEach(edge => {
    const i = nodes.findIndex(node => node.id === edge.id0);
    const j = nodes.findIndex(node => node.id === edge.id1);
    if (i !== -1 && j !== -1) {
      const distance = getDistance(nodes[i], nodes[j], 1000)

      matrix[i][j] = distance;
      matrix[j][i] = distance; // Undirected edges
    }
  });
  return matrix;
};


const dijkstraMatrix = (nodes: Node[], _edges: Edge[], startId: string, endId: string, matrix: number[][]) => {
  const queue = new MinQueue();
  const start = nodes.findIndex(node => node.id === startId);
  const end = nodes.findIndex(node => node.id === endId);
  const dist = Array(nodes.length).fill(Infinity);
  const prev = Array(nodes.length).fill(null);
  const visited = new Set();
  dist[start] = 0;

  queue.push(start, dist[start])

  let current = -1;
  let currentDist = -1;

  while (queue.size > 0 && !(queue.peek() == end) && queue.peekPriority() < Infinity) {
    const next = queue.pop()!;
    if (next == current || visited.has(next)) continue;

    current = next;
    currentDist = dist[current];

    visited.add(current);

    for (let id = 0; id < matrix[current].length; id++) {
      const idDist = matrix[current][id]
      if (idDist < Infinity) {
        const newDistance = currentDist + idDist
        if (newDistance < dist[id]) {
          dist[id] = newDistance;
          prev[id] = current;
          queue.push(id, newDistance)
        }
      }
    }
  }

  // Backtrack to get the path

  if (prev[end] === null) return []

  const path = [];
  for (let at = end; at !== null; at = prev[at]) {
    path.push(nodes[at].id);
  }

  return path.reverse();
};

let matrix: number[][] = [];

export const findPathWithDijkstra = (nodes: Node[], edges: Edge[], startId: string, endId: string, method: number, recreateMatrix = false) => {
  switch (method) {
    case 1:
      if (recreateMatrix || matrix.length == 0) {
        matrix = createAdjacencyMatrix(nodes, edges);
      }
      return dijkstraMatrix(nodes, edges, startId, endId, matrix);
    //TODO: Implment more methods! 
    default:
      throw new Error('Invalid method');
  }
};

// function main() {
//   const nodes = [{ id: "1", x: 0.1, y: 0.1, type: 0 }, { id: "2", x: 0.2, y: 0.2, type: 0 }, { id: "3", x: 0.1, y: 0.9, type: 0 }, { id: "4", x: 0.3, y: 0.3, type: 0 }, { id: "5", x: 0.3, y: 0.4, type: 0 }]
//   const edges = [{ id0: "1", id1: "2" }, { id0: "2", id1: "5" }, { id0: "1", id1: "3" }, { id0: "3", id1: "4" }, { id0: "5", id1: "4" }];
//   console.log(findPathWithDijkstra(nodes, edges, "1", "4", 1));
// }

// main()
