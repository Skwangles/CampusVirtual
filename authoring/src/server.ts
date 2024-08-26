import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import db from "./db"
import path from 'path'
const app = express();
const port = 5000;

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

  if (floorplans[name]) {
    const node = floorplans[name].nodes.find((node: any) => node.id === id);
    if (node) {
      node.x = x;
      node.y = y;
      res.sendStatus(200);
      console.log(floorplans[name])
    } else {
      res.status(404).send('Node not found');
    }
  } else {
    res.status(404).send('Floorplan not found');
  }


});

app.get('/api/floorplans/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  if (floorplans[name]) {
    res.json(floorplans[name]);
  } else {
    res.status(404).send('Floorplan not found');
  }
});

app.get('/api/floorplans', (req: Request, res: Response) => {
  res.json(Object.keys(floorplans));
});

async function initDB() {
  try {
    await db.query("BEGIN;");
    await db.query(`CREATE TABLE floorplan_images (
      location TEXT NOT NULL,
      path TEXT DEFAULT ''
      );`)
    await db.query(`CREATE TABLE floorplan_points (
        location TEXT NOT NULL,
        x DOUBLE PRECISION DEFAULT 0,
        y DOUBLE PRECISION DEFAULT 0,
        keyframe_id INTEGER REFERENCES refined_nodes (keyframe_id)
        );`)


    // Do by location to avoid causing a possible crash/memory overload
    const locations_result = await db.query(`SELECT DISTINCT location FROM refined_node_locations;`)
    const locations = locations_result.rows;
    for (const location of locations) {
      const nodes_result = await db.query(`SELECT n.keyframe_id, l.location FROM refined_nodes n JOIN refined_node_locations l ON l.keyframe_id = n.keyframe_id WHERE l.location = $1;`, [location.location])
      const nodes = nodes_result.rows
      for (const node of nodes) {
        // Don't need to wait for this
        db.query("INSERT INTO floorplan_points (location, keyframe_id) VALUES ($1, $2);", [location.location, node.keyframe_id])
      }
      db.query(`INSERT INTO floorplan_images (location) VALUES ($1)`, [location.location]);
    }
    await db.query("COMMIT;")
  }
  catch (e) {
    await db.query("ROLLBACK;");
    console.log("Already built x and Y, skipping DB init")
  }
}

app.listen(port, () => {
  initDB()
  console.log(`Server running on http://localhost:${port}`);
});
