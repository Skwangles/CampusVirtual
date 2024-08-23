import path from 'path'
import cors from 'cors'
import express from 'express'
import fs from 'fs'

import db from './db'
import { processImage } from './images'

const picturesDir = '/home/skwangles/Documents/Honours/CampusVirtual/pictures/'

const app = express()

app.use(cors({ origin: '*' }))
//@ts-ignore - We are compiling to CommonJS which has __dirname
app.use(express.static(path.join(__dirname, '../ui/dist')))

// render browser
app.get('/', function (req: any, res: { sendFile: (arg0: any) => void }) {
  //@ts-ignore - Compiling to CommonJS, which has __dirname
  res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
})

const send_test_image = false

const COORDS_TO_METRES = 40;

app.get('/point/:id/neighbours/:distance_thresh_m/:y_dist_thresh_m', async function (req: { params: { id: any; distance_thresh_m: any; y_dist_thresh_m: any } }, res: { status: (arg0: number) => { (): any; new(): any; send: { (arg0: string): { (): any; new(): any; end: { (): void; new(): any } }; new(): any } }; json: (arg0: any[]) => void }) {
  // Used BFS to find all points down the graph within a range
  const minDepth = 3; // case for when point distances are too large to give decent # of options
  const maxDepth = 10;


  const mainPointId = Number(req.params.id)

  const distanceThreshold = Number(req.params.distance_thresh_m) / COORDS_TO_METRES;
  const yDistThresh = Number(req.params.y_dist_thresh_m) / COORDS_TO_METRES

  if (isNaN(mainPointId) || isNaN(distanceThreshold) || isNaN(yDistThresh)) {
    res.status(400).send("Invalid params").end();
    return;
  }

  const getDistance = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2));
  };

  // Fetch the initial point
  const { rows: [currentPoint] } = await db.query(
    'SELECT x_trans, y_trans, z_trans FROM nodes WHERE keyframe_id = $1',
    [mainPointId]
  );
  if (!currentPoint) {
    res.status(400).send("Point ID given does not exist!").end()
    return
  }

  const { x_trans: x1, y_trans: y1, z_trans: z1 } = currentPoint;
  console.log("Current Point: ", mainPointId, currentPoint)

  // Initialize a queue for BFS and a set to keep track of visited nodes
  const queue: { keyframe_id: number, depth: number }[] = [{ keyframe_id: mainPointId, depth: 0 }];
  const visited = new Set<number>();
  const result = new Set<number>(); // keyframe_id => list of neighbors
  const output = [];

  visited.add(mainPointId);

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
       FROM edges e
       JOIN nodes n ON e.keyframe_id1 = n.keyframe_id
       WHERE e.keyframe_id0 = $1`,
      [keyframe_id]
    );

    for (const neighbour of neighbours) {
      const { keyframe_id: neighbourId, x_trans: x2, y_trans: y2, z_trans: z2 } = neighbour;

      // Check distance
      const distance = getDistance(x1 * COORDS_TO_METRES, y1 * COORDS_TO_METRES, z1 * COORDS_TO_METRES, x2 * COORDS_TO_METRES, y2 * COORDS_TO_METRES, z2 * COORDS_TO_METRES);
      if (distance < distanceThreshold || depth < minDepth) {
        if (Number(mainPointId) !== Number(neighbourId) && !result.has(neighbourId)) {
          result.add(neighbourId);
          output.push(neighbourId);
        }

        if (!visited.has(neighbourId)) {
          visited.add(neighbourId);
          queue.push({ keyframe_id: neighbourId, depth: depth + 1 });
        }
      }
    }
  }

  res.json(output)
})

app.get('/floorplan/:id', async function (req: { params: { id: any } }, res: any) {
  const id = req.params.id;
  const rows = await db.query(`
			SELECT n.keyframe_id, n.ts, n.pose
			FROM nodes n 
			JOIN node_locations l ON l.name = n.location
			WHERE l.location = 
				(SELECT location FROM nodes WHERE keyframe_id = $1)`, [id])
  // select from NODES, because it is the superset of refined_nodes, so regardless if using 'dense', or 'refined' viewing you'll always get a hit
  res.json(rows.rows)
})

app.get('/point/:id', async function (req: { params: { id: any } }, res: { json: (arg0: any) => void }) {
  const rows = await db.query(`
    SELECT n.keyframe_id, n.ts, n.pose, l.location
    FROM nodes n
    LEFT JOIN node_locations l ON n.keyframe_id = l.keyframe_id
    WHERE n.keyframe_id = $1;
    `, [req.params.id]);

  res.json(rows.rows[0])
})

const extension = ".png"
app.get('/image/:detail/:ts', function (req: { params: { ts: string, detail: string } }, res: any) {
  const ts = Number(req.params.ts).toFixed(5);
  if (ts === "NaN") {
    res.status(400).send("Image id was not a valid image ID")
    return;
  }

  const detail = req.params.detail; // TODO: Add optimisation to send lores or hires as needed
  if (detail !== "hires" && detail !== "lores" && detail !== "thumbnail") {
    res.status(400).send("The image detail must be 'lores', 'thumbnail' or 'hires'");
  }


  if (send_test_image) {
    res.sendFile(picturesDir + "test.jpg");
    console.log("Sending Test")
    return;
  }

  if (fs.existsSync(picturesDir + ts + extension)) {

    processImage(res, picturesDir + ts + extension, detail === "hires" ? -1 : (detail === "lores" ? 200 : 50))
  }
  else {
    res.sendFile(picturesDir + "test.jpg")
  }
})

const port = 3001
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
