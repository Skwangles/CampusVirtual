import sharp from "sharp";
import { COORDS_TO_METRES, KEYFRAME_IMG_EXTENSION, OUTDOORS_LOCATION_NAME, OUTDOORS_TARGET_CLOSENESS, OUTDOORS_Y_DIST_THRESHOLD, TARGET_CLOSENESS, Y_DIST_THRESHOLD } from "./consts";
import * as THREE from "three";

// Helper function to get node position
export async function getNodePosition(db: any, keyframeId: string, use_trans = true) {
  const nodeInfo = await getNodeInfo(db, keyframeId, use_trans);
  return nodeInfo["position"];
}


export async function getNodeInfo(db: any, keyframeId: string, use_trans = true) {

  const result = await db.query(
    "SELECT ts, label, pose, x_trans, y_trans, z_trans FROM refined_nodes WHERE keyframe_id = $1 LIMIT 1;",
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
    node_info["position"] = ret;
    return node_info;
  }

  const ret = calculatePositionFromMatrix(result.rows[0]?.pose);
  if (!ret)
    throw new Error(
      "Return result was Null of getNodePosition - calculating from pose"
    );
  node_info["position"] = ret;
  return ret;

}

// Helper function to get neighbours
export async function getNeighbours(db: any, keyframeId: number, usePhysicalProximity = false): Promise<any[]> {



  const directNeighbours = await db.query(
    `SELECT e.keyframe_id1 as keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM refined_edges e 
              JOIN refined_edges e1 ON e.keyframe_id1 = e1.keyframe_id0
              JOIN refined_nodes n ON e.keyframe_id1 = n.keyframe_id 
              WHERE e.keyframe_id0 = $1 AND (e.type = 0 OR e.type = 1) AND (e1.type = 0 OR e1.type = 1) 
              GROUP BY e.keyframe_id1, n.ts`,
    [keyframeId]
  );

  if (usePhysicalProximity) {
    const result = await db.query(`WITH target_point AS (
    SELECT 
        x_trans, 
        y_trans, 
        z_trans
    FROM refined_nodes
    WHERE keyframe_id = $1
    )
    SELECT 
        *
    FROM refined_nodes rn
    JOIN target_point ON (
        SQRT(
            POWER(rn.y_trans - target_point.y_trans, 2) +
            POWER(rn.x_trans - target_point.x_trans, 2) +
            POWER(rn.z_trans - target_point.z_trans, 2)
        ) <= $2
    )
    WHERE rn.keyframe_id != $1;`, [keyframeId, TARGET_CLOSENESS / COORDS_TO_METRES])
    return [...new Set([...directNeighbours.rows, ...result.rows])]
  }

  return directNeighbours.rows;
}

// Helper function to calculate distance between two positions
export function calculateXZDistance(pos1: number[], pos2: number[]): number {
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

export async function isNodeOutdoors(db: any, keyframeId: number) {
  const locData = await db.query("SELECT location from refined_node_locations WHERE keyframe_id = $1", [keyframeId])

  // If no location, take the more restrictive approach
  if (locData.rowCount === 0) return false;

  return locData.rows[0]["location"] === OUTDOORS_LOCATION_NAME;
}

// Helper function to delete a node and its edges
export async function replaceNode(db: any, keyframeId: number, position: [number, number, number], ignore_distance = false, isOutdoors = false) {
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
      if (!ignore_distance && (distance > (isOutdoors ? OUTDOORS_TARGET_CLOSENESS : TARGET_CLOSENESS) || yDistance > (isOutdoors ? OUTDOORS_Y_DIST_THRESHOLD : Y_DIST_THRESHOLD))) {
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

export function calculatePositionFromMatrix(
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
export async function calculateImageSharpness(filePath: string): Promise<number> {
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

export function convertTimestampToImagename(ts: Number | string) {
  return `${Number(ts).toFixed(5)}${KEYFRAME_IMG_EXTENSION}`
}

export async function getNextKeyframe(db: any, currentId: number) {
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
