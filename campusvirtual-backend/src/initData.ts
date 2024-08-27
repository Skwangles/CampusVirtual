import db from './db'
import { FLOOR_POINT_DEFAULT_TYPE, BORDERING_FLOOR_POINT_DEFAULT_TYPE } from './consts'
export default async function initDB() {
  try {
    console.debug("Initalising data...")
    await db.query(`CREATE TABLE floorplan_images (
      id SERIAL PRIMARY KEY,
      location TEXT,
      path TEXT DEFAULT ''
      );`);

    await db.query(`CREATE TABLE floorplan_points (
        id SERIAL PRIMARY KEY,
        location TEXT NOT NULL,
        x DOUBLE PRECISION DEFAULT 0,
        y DOUBLE PRECISION DEFAULT 0,
        keyframe_id INTEGER REFERENCES refined_nodes (keyframe_id),
        type INTEGER DEFAULT 0
        );`); // type - 0 is on floor, 50+ is a node of a type not on the current floor (so you can do a < 50 to get all on current floor)
  }
  catch (e) {

    console.log("Already built x and Y, skipping data init!")
    return;
  }
  try {
    await db.query("BEGIN;");
    // Do by location to avoid causing a possible crash/memory overload
    const locationsResult = await db.query(`SELECT DISTINCT location FROM refined_node_locations;`)
    const locations = locationsResult.rows.map((location: { location: string }) => location.location);
    console.log("Locations:", locations)
    for (const location of locations) {
      const nodesResult = await db.query(`SELECT n.keyframe_id, l.location, n.x_trans, n.z_trans FROM refined_nodes n JOIN refined_node_locations l ON l.keyframe_id = n.keyframe_id WHERE l.location = $1;`, [location])
      const borderNodesResult = await db.query(`SELECT keyframe_id1 as keyframe_id, l2.location, n.x_trans, n.z_trans FROM refined_edges e 
                    JOIN refined_node_locations l 
                    ON e.keyframe_id0 = l.keyframe_id 
                    JOIN refined_node_locations l2 ON e.keyframe_id1 = l2.keyframe_id
                    JOIN refined_nodes n ON n.keyframe_id = e.keyframe_id1
                    WHERE l.location = $1 AND l2.location <> $1;
                    `, [location])

      const nodes = nodesResult.rows
      const borderNodes = borderNodesResult.rows;
      console.info(`Location ${location} - Nodes: ${nodesResult.rowCount}, Border Nodes: ${borderNodesResult.rowCount}`)

      const combined_nodes = [...nodes, ...borderNodes]

      const maxX = Math.max(...combined_nodes.map((node: { x_trans: number }) => node.x_trans))
      const maxZ = Math.max(...combined_nodes.map((node: { z_trans: number }) => node.z_trans))
      const minX = Math.min(...combined_nodes.map((node: { x_trans: number }) => node.x_trans))
      const minZ = Math.min(...combined_nodes.map((node: { z_trans: number }) => node.z_trans))

      const clampToPostive = (val: number) => {
        return Math.max(0, Math.min(1, val))
      }

      for (const node of nodes) {
        // Don't need to wait for this
        const initX = clampToPostive((node.x_trans - minX) / (maxX - minX))
        const initY = clampToPostive((node.z_trans - minZ) / (maxZ - minZ))
        db.query("INSERT INTO floorplan_points (location, keyframe_id, type, x, y) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING;", [location, node.keyframe_id, FLOOR_POINT_DEFAULT_TYPE, initX, initY])
      }

      for (const border_node of borderNodes) {
        const initX = clampToPostive((border_node.x_trans - minX) / (maxX - minX))
        const initY = clampToPostive((border_node.z_trans - minZ) / (maxZ - minZ))

        db.query("INSERT INTO floorplan_points (location, keyframe_id, type, x, y) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING;", [location, border_node.keyframe_id, BORDERING_FLOOR_POINT_DEFAULT_TYPE, initX, initY])
      }

      db.query(`INSERT INTO floorplan_images (location) VALUES ($1) ON CONFLICT DO NOTHING`, [location]);
    }

    await db.query("COMMIT;")
    console.debug("Sucessfully initalised the data!")
  }
  catch (e) {
    await db.query("ROLLBACK;");
    console.debug("Data initialisation failed: ", e)
  }
}
