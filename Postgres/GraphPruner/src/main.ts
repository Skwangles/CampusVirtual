import db from "./db";
import * as THREE from "three";
import sharp from "sharp";
import {
  COORDS_TO_METRES,
  TARGET_CLOSENESS,
  ALWAYS_MERGE_CLOSENESS,
  Y_DIST_THRESHOLD,
} from "./consts";

// TODO: Look at  'A New Trajectory Reduction Method for Mobile Devices Operating Both Online and Offline'

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
}

// Function to calculate image blur using sharp
async function calculateImageSharpness(filePath: string): Promise<number> {
  try {
    const sharpness = await sharp(filePath)
      .stats()
      .then((stats) => {
        return stats.sharpness;
      });
    return sharpness;
  } catch (err) {
    console.error("Error processing image:", err);
    return 0; // Consider as most blurry if error
  }
}

async function getNextKeyframe(db: any, currentId: number) {
  let {
    rows: [nextFrame],
  }: { rows: Array<{ keyframe_id: string; degree: number; ts: number }> } =
    await db.query(
      `SELECT n.keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM refined_nodes n JOIN refined_edges e1 ON n.keyframe_id = e1.keyframe_id0
            WHERE n.keyframe_id > $1 AND (e1.type = 0 OR e1.type = 1)  GROUP BY n.keyframe_id, n.ts LIMIT 1`,
      [currentId]
    );
  return nextFrame;
}

/**
 * Loop through each node, if a node is within 5m keep the least blurry
 * (except if is a junction point, then never remove that one)
 */
async function useGreedyTripleRingStrategy(
  db: any,
  keep_degree_2_plus = false,
  image_directory = "/home/skwangles/Documents/Honours/CampusVirtual/pictures/",
  extension = ".png"
) {

  // removeAllSingleOffshoots(db);


  const firstFrame = await getNextKeyframe(db, -1);
  if (!firstFrame) {
    throw new Error("Could not find the first frame!");
  }

  let currentKeyframeId = Number(firstFrame.keyframe_id);
  let currentTs = Number(firstFrame.ts);

  console.log("First keyframe ID", currentKeyframeId);

  let stack = [currentKeyframeId]
  let visited = new Set();

  let addToStack = (id: number) => {
    if (!visited.has(id)) stack.push(id)
  }

  // Loop through every node
  while (stack.length > 0) {
    const currentKeyframeId = stack.pop()!
    if (visited.has(currentKeyframeId)) continue; // Sanity check we aren't adding duplicates
    visited.add(currentKeyframeId);

    let currentPosition = await getNodePosition(db, currentKeyframeId);
    let is_current_deleted = false;
    console.log("Current:", currentKeyframeId);

    const checkedNeighbours = new Set();
    let neighboursHaveChanged = true;
    while (neighboursHaveChanged && !is_current_deleted) {
      const neighbours = await getNeighbours(db, currentKeyframeId);
      neighboursHaveChanged = false;

      // Ignore single end nodes to avoid the small 1 depth leaves on an otherwise long stretch
      if (neighbours.length == 1) { // Will need to START from NOT an end node (e.g. id 2)
        const firstNeighbourId = Number(neighbours[0]!.keyframe_id)
        addToStack(firstNeighbourId)

        console.log("Removing self: ", currentKeyframeId)
        await replaceNode(db, currentKeyframeId, currentPosition)
        continue;
      }

      for (const neighbour of neighbours) {
        const neighbourId = Number(neighbour.keyframe_id);
        if (currentKeyframeId == neighbourId) continue

        addToStack(neighbourId);

        if (checkedNeighbours.has(neighbourId)) continue;
        checkedNeighbours.add(neighbourId); // Not using 'visited' here, because we want the 'current' to delete a previous node if it was found sharper

        const ts = neighbour.ts;
        const neighbourPosition = await getNodePosition(db, neighbourId);
        const distance = calculateXZDistance(
          currentPosition,
          neighbourPosition
        );

        const yDistance = Math.abs(neighbourPosition[1] - currentPosition[1]);

        if (yDistance > Y_DIST_THRESHOLD) {
          continue;
        }

        if (distance < TARGET_CLOSENESS || distance < ALWAYS_MERGE_CLOSENESS) {

          const currentSharpness =
            (await calculateImageSharpness(
              `${image_directory}${Number(currentTs).toFixed(5)}${extension}`
            )) ?? 0;
          const neighbourSharpness =
            (await calculateImageSharpness(
              `${image_directory}${Number(ts).toFixed(5)}${extension}`
            )) ?? 0;

          if (neighbourSharpness <= currentSharpness) {
            console.log(
              "Deleting neighbour",
              neighbourId,
              "with sharpness",
              neighbourSharpness
            );


            if (await replaceNode(db, neighbourId, neighbourPosition, distance <= ALWAYS_MERGE_CLOSENESS)) {
              neighboursHaveChanged = true;
              visited.add(neighbourId); // Its been deleted, so don't try visit it
            }
          } else {
            if (is_current_deleted) continue;
            is_current_deleted = true;
          }
        }
      }
    }
    if (is_current_deleted) {
      const neighbours = await getNeighbours(db, currentKeyframeId)
      for (const neighbour of neighbours) {
        if (!checkedNeighbours.has(neighbour.keyframe_id)) addToStack(neighbour.keyframe_id)
      }
      console.log("Deleteing current node:", currentKeyframeId)
      await replaceNode(db, currentKeyframeId, currentPosition);
    }
  }
}



async function copyDenseToRefined(db: any) {
  await db.query("DROP TABLE IF EXISTS refined_edges CASCADE;");
  await db.query("DROP TABLE IF EXISTS refined_node_locations CASCADE;");
  await db.query("DROP TABLE IF EXISTS refined_nodes CASCADE;");

  await db.query("SELECT * INTO refined_nodes FROM nodes;");
  await db.query("SELECT * INTO refined_node_locations FROM node_locations;");
  await db.query("SELECT * INTO refined_edges FROM edges;");

  await db.query(`
    BEGIN;
    ALTER TABLE refined_edges ADD PRIMARY KEY (keyframe_id0, keyframe_id1);
    ALTER TABLE refined_nodes ADD PRIMARY KEY (keyframe_id);
    ALTER TABLE refined_node_locations ADD PRIMARY KEY (keyframe_id);
    
    ALTER TABLE refined_nodes ADD CONSTRAINT unique_node UNIQUE (keyframe_id);
    ALTER TABLE refined_node_locations ADD CONSTRAINT node_locations_FK FOREIGN KEY (keyframe_id) REFERENCES refined_nodes (keyframe_id);
    
    ALTER TABLE refined_edges ADD CONSTRAINT ref_edge_id0_FK FOREIGN KEY (keyframe_id0) REFERENCES refined_nodes (keyframe_id);
    ALTER TABLE refined_edges ADD CONSTRAINT ref_edge_id1_FK FOREIGN KEY (keyframe_id1) REFERENCES refined_nodes (keyframe_id);
    ALTER TABLE refined_edges ADD CONSTRAINT unique_refined_edge UNIQUE (keyframe_id0, keyframe_id1);
    COMMIT;
    `);

}

// Main function to prune nodes
async function prune() {
  // await createTables(db);
  await copyDenseToRefined(db);
  console.log("Copied across nodes, edges and node_locations");
  try {
    // await db.query("BEGIN");
    // Find the first node in the list

    await useGreedyTripleRingStrategy(db);
    console.log("Committing");
    // await db.query("COMMIT");
  } catch (e) {
    console.log("Error:", e);
    await db.query("ROLLBACK");
  } finally {
  }
}

// Helper function to get node position
async function getNodePosition(db: any, keyframeId: number, use_trans = true) {
  const result = await db.query(
    "SELECT pose, x_trans, y_trans, z_trans FROM refined_nodes WHERE keyframe_id = $1 LIMIT 1;",
    [keyframeId]
  );
  const positionInfo = result.rows;
  if (!positionInfo || positionInfo.length == 0) {
    throw new Error("Could not find keyframe of ID: " + keyframeId);
  }

  const node_info = positionInfo[0];
  if (use_trans) {
    const ret: [number, number, number] = [
      node_info.x_trans * COORDS_TO_METRES,
      node_info.y_trans * COORDS_TO_METRES,
      node_info.z_trans * COORDS_TO_METRES,
    ];
    if (!ret) throw new Error("Return result was Null of getNodePosition");
    return ret;
  }

  const ret = calculatePositionFromMatrix(result.rows[0]?.pose);
  if (!ret)
    throw new Error(
      "Return result was Null of getNodePosition - calculating from pose"
    );
  return ret;
}

// Helper function to get neighbours
async function getNeighbours(db: any, keyframeId: number): Promise<any[]> {
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
function calculateXZDistance(pos1: number[], pos2: number[]): number {
  if (pos1.length < 3 || pos2.length < 3) {
    throw new Error("Invalid position array passed - has less then 3 values");
  }
  const result = Math.sqrt(
    Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[2] - pos2[2], 2)
  );

  if (result == null || result < 0) {
    throw new Error(
      "Distance calculation was NaN: [" + pos1 + "] [" + pos2 + "] " + result
    );
  }

  return result;
}

// Helper function to delete a node and its edges
async function replaceNode(db: any, keyframeId: number, position: [number, number, number], ignore_distance = false) {
  const direct_neighbours = (
    await db.query(
      "SELECT keyframe_id1 as keyframe_id FROM refined_edges WHERE keyframe_id0 = $1 AND (type = 0 OR type = 1)",
      [keyframeId]
    )
  ).rows;

  await db.query("BEGIN;");

  for (const neighbour_id in direct_neighbours) {
    const neighbour = direct_neighbours[neighbour_id];
    const pos = await getNodePosition(db, neighbour.keyframe_id)

    for (const new_neighbour of direct_neighbours.slice(neighbour_id)) {
      if (new_neighbour.keyframe_id == neighbour.keyframe_id) continue;
      const newNeighbourPosition = await getNodePosition(db, new_neighbour.keyframe_id)
      const distance = calculateXZDistance(newNeighbourPosition, pos);
      const yDistance = Math.abs(newNeighbourPosition[2] - pos[2])
      if (!ignore_distance && (distance > TARGET_CLOSENESS || yDistance > Y_DIST_THRESHOLD)) {
        console.debug("Cancelling delete - A new edge is too large - Distance:", distance, " ID:", neighbour.keyframe_id, " Compared ID:", new_neighbour.keyframe_id)
        await db.query("ROLLBACK;")
        return false;
      }
      await db.query(
        "INSERT INTO refined_edges (keyframe_id0, keyframe_id1, type) VALUES ($1, $2, 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = 1;",
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
      await db.query(
        "INSERT INTO refined_edges (keyframe_id1, keyframe_id0, type) VALUES ($1, $2, 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = 1;",
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
    }
  }

  await db.query(
    "DELETE FROM refined_edges WHERE keyframe_id0 = $1 OR keyframe_id1 = $1;",
    [keyframeId]
  );
  await db.query("DELETE FROM refined_node_locations WHERE keyframe_id = $1", [
    keyframeId,
  ]);
  await db.query("DELETE FROM refined_nodes WHERE keyframe_id = $1;", [
    keyframeId,
  ]);

  await db.query("COMMIT;")
  return true;
}

prune().catch(console.error);
