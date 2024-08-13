import db from "./db";
import * as THREE from "three";
import * as fs from 'fs';
import * as path from 'path';
import sharp, { strategy } from 'sharp';

const COORDS_TO_METRES = 40;
const TARGET_CLOSENESS = 8;

function calculatePositionFromMatrix(
  matrix: number[]
): [number, number, number] {
  const m = new THREE.Matrix4();
  //@ts-ignore
  m.set(...matrix);
  m.invert();
  const position = new THREE.Vector3();
  position.setFromMatrixPosition(m);
  return [
    -position.x * COORDS_TO_METRES,
    -position.y * COORDS_TO_METRES,
    position.z * COORDS_TO_METRES,
  ];
};


// Function to calculate image blur using sharp
async function calculateImageSharpness(filePath: string): Promise<number> {
  try {
    const sharpness = await sharp(filePath)
      .stats()
      .then(stats => {
        return stats.sharpness;
      });
    return sharpness;
  } catch (err) {
    console.error('Error processing image:', err);
    return 0; // Consider as most blurry if error
  }
}

async function getNextKeyframe(db: any, currentId: number) {
  let { rows: [nextFrame] }: { rows: Array<{ keyframe_id: string, degree: number, ts: number }> } = await db.query(
    `SELECT n.keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM refined_nodes n JOIN refined_edges e1 ON n.keyframe_id = e1.keyframe_id0
            WHERE n.keyframe_id > $1 AND (e1.type = 0 OR e1.type = 1)  GROUP BY n.keyframe_id, n.ts LIMIT 1`, [currentId]
  );
  return nextFrame;
}


/**
 * Loop through each node, if a node is within 5m keep the least blurry
 * (except if is a junction point, then never remove that one) 
 */
async function useGreedyStrategy(db: any, keep_degree_2_plus = false, image_directory = "/home/skwangles/Documents/Honours/CampusVirtual/pictures/", extension = ".png") {
  const firstFrame = await getNextKeyframe(db, -1);
  if (!firstFrame) {
    throw new Error("Could not find the first frame!")
  }

  let currentDegree = Number(firstFrame.degree)
  let currentKeyframeId = Number(firstFrame.keyframe_id)
  let currentTs = Number(firstFrame.ts);

  console.log('First keyframe ID', currentKeyframeId);

  // Loop through every node
  while (currentKeyframeId != null) {
    let currentPosition = await getNodePosition(db, currentKeyframeId);

    console.log('Current:', currentKeyframeId);

    // Find the direct neighbours 
    let neighbours = await getNeighbours(db, currentKeyframeId);
    for (const neighbour of neighbours) {
      const neighbourId = neighbour.keyframe_id;
      const ts = neighbour.ts;
      if (keep_degree_2_plus && neighbour.degree > 2 && currentDegree > 2) {
        // Can only delete degree <= 2 to avoid ruining intersections
        console.log("Skipping:", neighbour, " and ", currentDegree)
        continue
      }

      const neighbourPosition = await getNodePosition(db, neighbourId);
      const distance = calculateDistance(currentPosition, neighbourPosition);

      if (distance < TARGET_CLOSENESS) {

        const currentSharpness = await calculateImageSharpness(`${image_directory}${Number(currentTs).toFixed(5)}${extension}`);
        const neighbourSharpness = await calculateImageSharpness(`${image_directory}${Number(ts).toFixed(5)}${extension}`);

        // TODO: Maybe replace the intersection with the least blurry? Update that node's ts and pose
        if ((keep_degree_2_plus && currentDegree > 2) || neighbourSharpness < currentSharpness) {
          console.log('Deleting neighbour', neighbourId, 'with sharpness', neighbourSharpness);
          await replaceNode(db, neighbourId);
        } else {
          console.log('Deleting current node', currentKeyframeId, 'with sharpness', currentSharpness);
          await replaceNode(db, currentKeyframeId);
        }
      }
    }
    const result = await getNextKeyframe(db, currentKeyframeId)
    if (!result) break;

    currentDegree = Number(result.degree)
    currentKeyframeId = Number(result.keyframe_id)
    currentTs = Number(result.ts)
  }
}




function calculateCellIndex(x: number, y: number, z: number, cellsize = TARGET_CLOSENESS, scale = COORDS_TO_METRES) {
  return [
    Math.floor((x * COORDS_TO_METRES) / cellsize),
    Math.floor((y * COORDS_TO_METRES) / cellsize),
    Math.floor((z * COORDS_TO_METRES) / cellsize)
  ]
}

// async function findNeighboursInSameCell(mainPointId: number, maxDepth: number = 20, cellsize: number = 10) {

//   // Fetch the initial point
//   const { rows: [currentPoint] } = await db.query(
//     'SELECT x_trans, y_trans, z_trans FROM nodes WHERE keyframe_id = $1',
//     [mainPointId]
//   );

//   if (!currentPoint) {
//     throw new Error('Current point not found');
//   }

//   const { x_trans: x1, y_trans: y1, z_trans: z1 } = currentPoint;
//   console.log("Current Point: ", currentPoint)

//   const currentCell = calculateCellIndex(x1, y1, z1, cellsize);

//   // Initialize a queue for BFS and a set to keep track of visited nodes
//   const queue: { keyframe_id: number, depth: number }[] = [{ keyframe_id: mainPointId, depth: 0 }];
//   const visited = new Set<number>();
//   const result = new Set();

//   visited.add(mainPointId);

//   while (queue.length > 0) {
//     const { keyframe_id, depth } = queue.shift()!;
//     console.log("Looking for keyframe_id:", keyframe_id, " at depth ", depth)

//     if (depth >= maxDepth) continue;

//     // Fetch neighbors at current depth
//     const { rows: neighbours } = await db.query(
//       `SELECT e.keyframe_id1 AS keyframe_id,
//               n.x_trans,
//               n.y_trans,
//               n.z_trans,
//               n.ts,
//               n.pose
//        FROM edges e
//        JOIN nodes n ON e.keyframe_id1 = n.keyframe_id
//        WHERE e.keyframe_id0 = $1`,
//       [keyframe_id]
//     );

//     for (const neighbour of neighbours) {
//       const { keyframe_id: neighborId, x_trans: x2, y_trans: y2, z_trans: z2 } = neighbour;

//       const cell = calculateCellIndex(x2, y2, z2, cellsize);
//       if (cell === currentCell) {
//         if (mainPointId !== keyframe_id && !result.has(neighbour)) {
//           result.add(neighbour);
//         }

//         if (!visited.has(neighborId)) {
//           visited.add(neighborId);
//           queue.push({ keyframe_id: neighborId, depth: depth + 1 });
//         }
//       }
//     }
//   }

//   return result;
// }


// async function findNeighboursBFSdistance(mainPointId: number, maxDepth: number = 20, distanceThresholdM: number = TARGET_CLOSENESS) {

//   const distanceThreshold = distanceThresholdM / COORDS_TO_METRES;

//   // Fetch the initial point
//   const { rows: [currentPoint] } = await db.query(
//     'SELECT x_trans, y_trans, z_trans FROM nodes WHERE keyframe_id = $1',
//     [mainPointId]
//   );

//   if (!currentPoint) {
//     throw new Error('Current point not found');
//   }

//   const { x_trans: x1, y_trans: y1, z_trans: z1 } = currentPoint;
//   console.log("Current Point: ", currentPoint)

//   // Initialize a queue for BFS and a set to keep track of visited nodes
//   const queue: { keyframe_id: number, depth: number }[] = [{ keyframe_id: mainPointId, depth: 0 }];
//   const visited = new Set<number>();
//   const result = new Set();

//   visited.add(mainPointId);

//   while (queue.length > 0) {
//     const { keyframe_id, depth } = queue.shift()!;
//     console.log("Looking for keyframe_id:", keyframe_id, " at depth ", depth)

//     if (depth >= maxDepth) continue;

//     // Fetch neighbors at current depth
//     const { rows: neighbours } = await db.query(
//       `SELECT e.keyframe_id1 AS keyframe_id,
//               n.x_trans,
//               n.y_trans,
//               n.z_trans,
//               n.ts,
//               n.pose
//        FROM edges e
//        JOIN nodes n ON e.keyframe_id1 = n.keyframe_id
//        WHERE e.keyframe_id0 = $1`,
//       [keyframe_id]
//     );

//     for (const neighbour of neighbours) {
//       const { keyframe_id: neighborId, x_trans: x2, y_trans: y2, z_trans: z2 } = neighbour;

//       // Check distance
//       const distance = calculateDistance([x1, y1, z1], [x2, y2, z2]);
//       if (distance < distanceThreshold) {
//         if (mainPointId !== keyframe_id && !result.has(neighbour)) {
//           result.add(neighbour);
//         }

//         if (!visited.has(neighborId)) {
//           visited.add(neighborId);
//           queue.push({ keyframe_id: neighborId, depth: depth + 1 });
//         }
//       }
//     }
//   }

//   return result;
// }


async function copyDenseToRefined(db: any) {
  await db.query("DROP TABLE IF EXISTS refined_edges CASCADE;")
  await db.query("DROP TABLE IF EXISTS refined_node_locations CASCADE;")
  await db.query("DROP TABLE IF EXISTS refined_nodes CASCADE;")
  await db.query("SELECT * INTO refined_nodes FROM nodes;")
  await db.query("SELECT * INTO refined_node_locations FROM node_locations;")
  await db.query("SELECT * INTO refined_edges FROM edges;")

  await db.query("ALTER TABLE refined_edges ADD CONSTRAINT unique_refined_edge UNIQUE (keyframe_id0, keyframe_id1)")
}


// Main function to prune nodes
async function prune() {

  // await createTables(db);
  await copyDenseToRefined(db);
  console.log("Copied across nodes, edges and node_locations")
  try {
    await db.query('BEGIN');
    // Find the first node in the list

    await useGreedyStrategy(db)
    console.log('Committing');
    await db.query('COMMIT');
  } catch (e) {
    console.log('Error:', e);
    await db.query('ROLLBACK');
  } finally {
  }
}

// Helper function to get node position
async function getNodePosition(db: any, keyframeId: number, use_trans = true) {
  const result = await db.query(
    'SELECT pose, x_trans, y_trans, z_trans FROM refined_nodes WHERE keyframe_id = $1 LIMIT 1;',
    [keyframeId]);
  const positionInfo = result.rows;
  if (!positionInfo || positionInfo.length == 0) {
    throw new Error("Could not find keyframe of ID: " + keyframeId)
  }

  const node_info = positionInfo[0];
  if (use_trans) {
    const ret = [node_info.x_trans * COORDS_TO_METRES, node_info.y_trans * COORDS_TO_METRES, node_info.z_trans * COORDS_TO_METRES]
    if (!ret) throw new Error("Return result was Null of getNodePosition")
    return ret;
  }

  const ret = calculatePositionFromMatrix(result.rows[0]?.pose);
  if (!ret) throw new Error("Return result was Null of getNodePosition - calculating from pose")
  return ret
}

// Helper function to get neighbours
async function getNeighbours(db: any, keyframeId: number) {
  const result = await db.query(
    `SELECT e.keyframe_id1 as keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM refined_edges e 
              JOIN refined_edges e1 ON e.keyframe_id1 = e1.keyframe_id0
              JOIN refined_nodes n ON e.keyframe_id1 = n.keyframe_id 
              WHERE e.keyframe_id0 = $1 AND (e.type = 0 OR e.type = 1) AND (e1.type = 0 OR e1.type = 1) 
              GROUP BY e.keyframe_id1, n.ts`,
    [keyframeId]
  );
  return result.rows;
}

// Helper function to calculate distance between two positions
function calculateDistance(pos1: number[], pos2: number[]): number {
  if (pos1.length < 3 || pos2.length < 3) {
    throw new Error("Invalid position array passed - has less then 3 values")
  }
  const result = Math.sqrt(
    Math.pow(pos1[0] - pos2[0], 2) +
    Math.pow(pos1[2] - pos2[2], 2)
  );

  if (!result) {
    throw new Error("Distance calculation was NaN:" + pos1 + " " + pos2 + " " + result);
  }

  return result;
}

// Helper function to delete a node and its edges
async function replaceNode(db: any, keyframeId: number) {
  const direct_neighbours = (await db.query('SELECT keyframe_id1 as keyframe_id FROM refined_edges WHERE keyframe_id0 = $1 AND (type = 0 OR type = 1)', [keyframeId])).rows;

  for (const neighbour_id in direct_neighbours) {
    const neighbour = direct_neighbours[neighbour_id]
    for (const new_neighbour of direct_neighbours.slice(neighbour_id)) {
      if (new_neighbour.keyframe_id == neighbour.keyframe_id) continue;
      await db.query('INSERT INTO refined_edges (keyframe_id0, keyframe_id1, type) VALUES ($1, $2, 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = 1;', [neighbour.keyframe_id, new_neighbour.keyframe_id])
      await db.query('INSERT INTO refined_edges (keyframe_id1, keyframe_id0, type) VALUES ($1, $2, 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = 1;', [neighbour.keyframe_id, new_neighbour.keyframe_id])
    }
  }

  await db.query(
    'DELETE FROM refined_edges WHERE keyframe_id0 = $1 OR keyframe_id1 = $1;',
    [keyframeId]
  );
  await db.query('DELETE FROM refined_node_locations WHERE keyframe_id = $1', [keyframeId]);
  await db.query(
    'DELETE FROM refined_nodes WHERE keyframe_id = $1;',
    [keyframeId]
  );
}

prune().catch(console.error);
