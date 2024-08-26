import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import db from "./db"
import path from 'path'
const app = express();
const port = 5000;

const BORDERING_FLOOR_POINT_DEFAULT_TYPE = 50;
const FLOOR_POINT_DEFAULT_TYPE = 0;

app.use(cors({ origin: '*' }))
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../ui/dist')))


const floorplans: { [key: string]: any } = {
  'floorplan1': {
    image: '/S-G.png',
    nodes: [
      { id: 'node1', x: .1, y: .20 },
      { id: 'node2', x: .30, y: .40 },
    ],
    edges: [
      { id0: 'node1', id1: 'node2' }
    ]
  },
  // Add other floorplans here
};

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
})



app.post('/api/floorplans/:name/update', (req: Request, res: Response) => {
  const { name } = req.params;
  const { id, x, y } = req.body;

  db.query("UPDATE floorplan_points SET x = $1, y = $2 WHERE keyframe_id = $3 AND location = $4;", [x, y, id, name]).then(
    (val: any) => {
      console.log(val)
      if (val.rowCount > 0) {
        res.sendStatus(200)
      }
      else {
        res.status(404).send("Could not find point to update")
      }
    }
  ).catch(() => {
    res.status(404).send("Error updating point")
  });

});

app.get('/api/floorplans/:name', async (req: Request, res: Response) => {
  const { name } = req.params;

  // Includes keyframes bordering the floor (add 'AND type < 50' to exclude)
  const pointResult = await db.query("SELECT keyframe_id, x, y, type FROM floorplan_points WHERE location = $1", [name]);
  const image = await db.query("SELECT path FROM floorplan_images WHERE location = $1 LIMIT 1;", [name])

  const edges = await db.query(`SELECT  e.keyframe_id0, e.keyframe_id1 FROM refined_edges e JOIN floorplan_points f ON e.keyframe_id0 = f.keyframe_id WHERE f.location = $1 AND f.type < $2`, [name, BORDERING_FLOOR_POINT_DEFAULT_TYPE])
  if (pointResult.rowCount && pointResult.rowCount > 0 && image.rowCount && image.rowCount > 0) {
    res.json({ nodes: pointResult.rows, image: image.rows[0].path, edges: edges.rows })
  } else {
    res.status(404).send('Floorplan not found');
  }
});

app.get('/api/floorplans', async (req: Request, res: Response) => {
  const floorplanResults = await db.query("SELECT DISTINCT location FROM floorplan_images;")
  res.json(floorplanResults.rows.map((val: { location: string }) => val.location));
});

async function initDB() {
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

app.listen(port, () => {
  initDB();
  console.log(`Server running on http://localhost:${port}`);
});
