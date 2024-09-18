import db from "./db";

import {
  TARGET_CLOSENESS,
  ALWAYS_MERGE_CLOSENESS,
  Y_DIST_THRESHOLD,
  KEYFRAME_IMG_DIR,
  KEYFRAME_IMG_EXTENSION,
} from "./consts";
import { calculateImageSharpness, calculateXZDistance, getNeighbours, getNextKeyframe, getNodePosition, replaceNode } from './utils'

// TODO: Look at  'A New Trajectory Reduction Method for Mobile Devices Operating Both Online and Offline' paper

/**
 * Loop through each node, if a node is within 5m keep the least blurry
 * (except if is a junction point, then never remove that one)
 */
async function useGreedyTripleRingStrategy(
  db: any,
  image_directory = KEYFRAME_IMG_DIR,
  extension = KEYFRAME_IMG_EXTENSION
) {

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

prune().catch(console.error);
