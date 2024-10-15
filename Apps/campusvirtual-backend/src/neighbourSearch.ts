import { Request, Response } from 'express'
import { COORDS_TO_METRES, NEIGHBOURS_INCLUDES_PROXIMITY } from './consts';
import db from './db';

export async function searchNeighbour(is_refined: boolean, mainPointId: number, distanceThreshold: number, yDistThresh: number, currentPoint: { x_trans: any; y_trans: any; z_trans: any; }) {
  // Used BFS to find all points down the graph within a range
  const minDepth = 2; // case for when point distances are too large to give decent # of options
  const maxDepth = 5;
  const usePhysicalProximity = NEIGHBOURS_INCLUDES_PROXIMITY ?? true;

  const getDistance = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    return [Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(z2 - z1, 2)), Math.abs(y2 - y1)];
  };

  const { x_trans: x1, y_trans: y1, z_trans: z1 } = currentPoint;
  console.log("Current Point: ", mainPointId, currentPoint)

  // Initialize a queue for BFS and a set to keep track of visited nodes
  const queue: { keyframe_id: number, depth: number }[] = [{ keyframe_id: mainPointId, depth: 0 }];
  const visited = new Set<number>();
  const result = new Set<number>(); // keyframe_id => list of neighbors
  const output = []

  visited.add(mainPointId);

  if (usePhysicalProximity) {
    const resultData = await db.query(`WITH target_point AS (
    SELECT 
        x_trans, 
        y_trans, 
        z_trans
    FROM ${is_refined ? "refined_" : ""}nodes
    WHERE keyframe_id = $1
    )
    SELECT 
        keyframe_id
    FROM ${is_refined ? "refined_" : ""}nodes rn
    JOIN target_point ON (
            abs(rn.y_trans - target_point.y_trans) <= $3 
          AND
            POWER(rn.x_trans - target_point.x_trans, 2) +
            POWER(rn.z_trans - target_point.z_trans, 2)
         <= $2
    )
    WHERE rn.keyframe_id != $1;`, [mainPointId, Math.pow(distanceThreshold / COORDS_TO_METRES, 2), yDistThresh / (COORDS_TO_METRES * 2)])
    console.log("Phsyical proximity: ", resultData.rows)
    for (const row of resultData.rows) {
      const id: number = Number(row["keyframe_id"])
      output.push((await db.query(`SELECT keyframe_id, x_trans, y_trans, z_trans, ts, pose FROM ${is_refined ? "refined_" : ""}nodes WHERE keyframe_id = $1`, [id])).rows[0])
      result.add(id)
      queue.push({ keyframe_id: id, depth: 1 })
    }

  }

  while (queue.length > 0) {
    const { keyframe_id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    // Fetch neighbors at current depth
    const { rows: neighbours } = await db.query(
      `SELECT e.keyframe_id1 AS keyframe_id,
              n.x_trans,
              n.y_trans,
              n.z_trans,
              n.ts,
              n.pose
       FROM ${is_refined ? "refined_" : ""}edges e
       JOIN ${is_refined ? "refined_" : ""}nodes n ON e.keyframe_id1 = n.keyframe_id
       WHERE e.keyframe_id0 = $1`,
      [keyframe_id]
    );

    for (const neighbour of neighbours) {
      const { keyframe_id: neighbourId, x_trans: x2, y_trans: y2, z_trans: z2 } = neighbour;

      // Check distance
      const [distance, y_dist] = getDistance(x1 * COORDS_TO_METRES, y1 * COORDS_TO_METRES, z1 * COORDS_TO_METRES, x2 * COORDS_TO_METRES, y2 * COORDS_TO_METRES, z2 * COORDS_TO_METRES);

      if ((distance < distanceThreshold && y_dist < yDistThresh) || depth < minDepth) {

        if (Number(mainPointId) !== Number(neighbourId) && !result.has(neighbourId)) {
          result.add(neighbourId);
          output.push(neighbour)
        }

        if (!visited.has(neighbourId)) {
          visited.add(neighbourId);
          queue.push({ keyframe_id: neighbourId, depth: depth + 1 });
        }
      }
    }
  }

  return output
}