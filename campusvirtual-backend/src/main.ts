import path from 'path'
import cors from 'cors'
import express from 'express'
import fs from 'fs'

import db from './db'
import { processImage } from './images'

const picturesDir = '/home/skwangles/Documents/Honours/CampusVirtual/pictures/'

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.static(path.join(__dirname, '../ui/dist')))

// render browser
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
})

const send_test_image = false

const COORDS_TO_METRES = 10;

app.get('/point/:id/neighbours/:is_refined/:distance_thresh_m/:y_dist_thresh_m', async function (req, res) {
  // Used BFS to find all points down the graph within a range
  const minDepth = 1; // case for when point distances are too large to give decent # of options
  const maxDepth = 5;

  const is_refined = Boolean(req.params.is_refined === 'true');
  console.log(is_refined, req.params)
  const mainPointId = Number(req.params.id)

  const distanceThreshold = Number(req.params.distance_thresh_m);
  const yDistThresh = Number(req.params.y_dist_thresh_m);

  if (isNaN(mainPointId) || isNaN(distanceThreshold) || isNaN(yDistThresh)) {
    res.status(400).send("Invalid params").end();
    return;
  }

  const getDistance = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    return [Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(z2 - z1, 2)), Math.abs(y2 - y1)];
  };

  // Fetch the initial point
  const { rows: [currentPoint] } = await db.query(
    `SELECT x_trans, y_trans, z_trans FROM ${is_refined ? "refined_" : ""}nodes WHERE keyframe_id = $1`,
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
  const output = []

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

  res.json(output)
})


app.get('/point/:id/:is_refined', async function (req: { params: { id: number, is_refined: string } }, res: { json: (arg0: any) => void }) {

  const is_refined = Boolean(req.params.is_refined == 'true');
  const rows = await db.query(`
    SELECT n.keyframe_id, n.ts, n.pose, l.location
    FROM ${is_refined ? "refined_" : ""}nodes n
    LEFT JOIN ${is_refined ? "refined_" : ""}node_locations l ON n.keyframe_id = l.keyframe_id
    WHERE n.keyframe_id = $1;
    `, [Number(req.params.id)]);

  res.json(rows.rows[0])
})

app.get('/floors', async function (req: any, res: any) {
  res.json((await db.query("SELECT DISTINCT location FROM refined_node_locations")).rows)
})


app.get('/floor/:floor/neighbours/', async function (req: any, res: any) {
  const neighbours = await db.query("SELECT n.keyframe_id, n.pose FROM refined_nodes n JOIN refined_node_locations l ON n.keyframe_id = l.keyframe_id WHERE l.location = $1", [req.params.floor]);
  if (neighbours.rows.length == 0) {
    res.status(404).send("Floor not found").end()
    return;
  }
  res.json(neighbours.rows)
})

app.get('/floor/:floor/point/', async function (req: any, res: any) {
  console.log("Hit floor endpoint")
  // Get FIRST node which has that location
  const nodeWithSpecialLabel = await db.query("SELECT keyframe_id, pose FROM refined_nodes WHERE label = $1", [req.params.floor])

  if (nodeWithSpecialLabel.rows.length != 0) {
    console.log("Found a label", nodeWithSpecialLabel)
    res.json(nodeWithSpecialLabel.rows[0])
    return;
  }
  const firstNodeWithLocation = await db.query("SELECT n.keyframe_id FROM refined_nodes n JOIN refined_node_locations l ON n.keyframe_id = l.keyframe_id WHERE l.location = $1 LIMIT 1", [req.params.floor])
  if (firstNodeWithLocation.rows.length > 0) {
    console.log("Returning rows")
    res.json(firstNodeWithLocation.rows[0])
  }
  else {
    console.log("Could not find")
    res.status(404).send("Could not find any nodes with that location").end();
  }
})

app.get('/floorplan/:id/:is_refined', async function (req: any, res: any) {
  const id = Number(req.params.id);
  const is_refined = Boolean(req.params.is_refined);
  const rows = await db.query(`
			SELECT n.keyframe_id, n.ts, n.pose
			FROM ${is_refined ? "refined_" : ""}nodes n 
			JOIN ${is_refined ? "refined_" : ""}node_locations l ON l.name = n.location
			WHERE l.location = 
				(SELECT location FROM ${is_refined ? "refined_" : ""}nodes WHERE keyframe_id = $1)`, [id])
  res.json(rows.rows)
})


const extension = ".png"
app.get('/image/:detail/:ts', function (req: { params: { ts: string, detail: string } }, res) {
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
