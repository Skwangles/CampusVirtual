
import { BORDERING_FLOOR_POINT_DEFAULT_TYPE } from './consts'

// Helper function to get neighbours
export async function getNeighbours(db: any, keyframeId: number): Promise<any[]> {
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



// Helper function to delete a node and its edges
export async function replaceNode(db: any, keyframeId: number) {

  const direct_neighbours = (
    await db.query(
      "SELECT keyframe_id1 as keyframe_id FROM refined_edges WHERE keyframe_id0 = $1 AND (type = 0 OR type = 1)",
      [keyframeId]
    )
  ).rows;

  await db.query("BEGIN;");

  for (const neighbour_id in direct_neighbours) {
    const neighbour = direct_neighbours[neighbour_id];

    for (const new_neighbour of direct_neighbours.slice(neighbour_id)) {
      if (new_neighbour.keyframe_id == neighbour.keyframe_id) continue;
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

  // TODO: Gracefully handle deleteing border nodes
  const result = await db.query("DELETE FROM floorplan_points WHERE keyframe_id = $1 AND NOT EXISTS (SELECT * FROM floorplan_points WHERE keyframe_id = $1 AND type >= $2);", [keyframeId, BORDERING_FLOOR_POINT_DEFAULT_TYPE]);
  if (result.rowCount == 0) {
    await db.query("ROLLBACK;")
    console.error("Tried to delete a border node - this will cause problems in other floors")
    return false;
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

import path from 'path'

export function stripDirectoryTraversal(user_input: string, root: string) {
  var safe_input = path.normalize(user_input);
  if (safe_input.indexOf(root) !== 0) {
    return false;
  }
  return safe_input;
}