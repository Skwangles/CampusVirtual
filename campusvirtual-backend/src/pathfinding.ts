import { Client } from "pg";
import db from "./db"

import { MinQueue } from 'heapify';
import Pool from "pg-pool";
import { getNeighbours, getNodePosition } from "./utils";

interface Node {
  keyframe_id: number;
  x_trans: number | null;
  y_trans: number | null;
  z_trans: number | null;
}

interface Edge {
  id: number;
  keyframe_id0: number;
  keyframe_id1: number;
}

interface GraphNode {
  id: number;
  neighbors: Map<number, number>; // Map<neighbor_id, distance>
}

// Function to calculate Euclidean distance between two nodes
function calculateDistance(nodeA: [number, number, number], nodeB: [number, number, number]): number {
  const dx = nodeA[0] - nodeB[0];
  const dy = nodeA[1] - nodeB[1];
  const dz = nodeA[2] - nodeB[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}


async function fetchNode(client: Pool<Client>, nodeId: number): Promise<Node | null> {
  const result = await client.query('SELECT id, x_trans, y_trans, z_trans FROM refined_nodes WHERE id = $1', [nodeId]);
  return result.rows.length > 0 ? result.rows[0] as Node : null;
}

async function fetchEdges(client: Pool<Client>, nodeId: number): Promise<Edge[]> {
  const result = await client.query('SELECT keyframe_id0, keyframe_id1 FROM refined_edges WHERE keyframe_id0 = $1 OR keyframe_id1 = $1', [nodeId]);
  return result.rows as Edge[];
}

/**
 * 
 * @param db 
 * @param startId 
 * @param endId 
 * @param firstWith - Give location/label here to shortcircuit, if along the track it finds a point earlier that meets the label/location
 * @returns 
 */
export async function aStarPathfinding(
  db: Pool<Client>,
  startId: number,
  endId: number,
  firstWith: string | null = null // Allow shortcircuit if it finds a point earlier that meets criteria
): Promise<number[]> {
  const openSet = new MinQueue();
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();

  openSet.push(startId, 0);
  gScore.set(startId, 0);
  fScore.set(startId, await heuristic(db, startId, endId));

  while (openSet.size > 0) {
    const currentId = openSet.pop()!;

    const currentNodeData = (await db.query("SELECT n.keyframe_id, label, location FROM refined_nodes n JOIN refined_node_locations nl ON n.keyframe_id = nl.keyframe_id WHERE n.keyframe_id = $1", [currentId])).rows
    if (currentNodeData.length == 0) {
      return []; // An error occured, fail quickly
    }
    const currentNode = currentNodeData[0]

    if (currentId === endId || (firstWith && (currentNode.label == firstWith || currentNode.location == firstWith))) {
      // Backtrack to find final path
      const path: number[] = [];
      let node = endId;
      while (node) {
        path.push(node);
        node = cameFrom.get(node)!;
      }
      return path.reverse();
    }

    const currentPos = await getNodePosition(db, currentId)
    const neighbours = await getNeighbours(db, currentId);

    for (const neighbour of neighbours) {
      const nodeData = await getNodePosition(db, neighbour.keyframe_id)
      const distance = calculateDistance(
        currentPos,
        nodeData
      );
      const tentativeGScore = (gScore.get(currentId) ?? Infinity) + distance;
      if (tentativeGScore < (gScore.get(neighbour.keyframe_id) ?? Infinity)) {
        cameFrom.set(neighbour.keyframe_id, currentId);
        gScore.set(neighbour.keyframe_id, tentativeGScore);
        const neighborHeuristic = await heuristic(db, neighbour.keyframe_id, endId);
        fScore.set(neighbour.keyframe_id, tentativeGScore + neighborHeuristic);
        openSet.push(neighbour.keyframe_id, fScore.get(neighbour.keyframe_id) ?? Infinity);
      }
    }
  }

  return []; // No path was found
}

async function heuristic(db: Pool<Client>, nodeId: number, endId: number): Promise<number> {
  const node = await getNodePosition(db, nodeId);
  const endNode = await getNodePosition(db, endId);
  if (node && endNode) {
    return calculateDistance(node, endNode);
  }
  return Infinity;
}
