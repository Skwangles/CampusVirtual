import path from 'path'
import cors from 'cors'
import express from 'express'
import fs from 'fs'
import initData from './initData'
import { COORDS_TO_METRES, ENABLE_AUTHORING_PAGE, KEYFRAME_IMG_DIR, KEYFRAME_IMG_EXTENSION, SEND_TEST_IMAGE } from './consts'
import { searchNeighbour } from './neighbourSearch'
import db from './db'
import { processImage } from './images'
import floorplanAPI from './authoring'
import { aStarPathfinding } from './pathfinding'


const app = express()

app.use(cors({ origin: '*' }))
app.use(express.static(path.join(__dirname, '../ui/dist')))

// render browser
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
})

app.get('/point/:id/path/:location', async function (req, res) {
  const point = Number(req.params.id)
  const locationCode = String(req.params.location)
  console.log(locationCode)

  // Check label first, as these are manually annotated (and supposedly special) points
  let locationResults = await db.query("SELECT n.keyframe_id FROM refined_nodes n WHERE n.label = $1 LIMIT 1;", [locationCode]);
  if (locationResults.rowCount == 0) {
    const firstPointWithLocation = (await db.query("SELECT n.keyframe_id FROM refined_nodes n JOIN refined_node_locations nl ON n.keyframe_id = nl.keyframe_id WHERE nl.location = $1 LIMIT 1;", [locationCode]));
    if (firstPointWithLocation.rowCount === 0) {
      res.status(400).send("End location could not be found");
      return
    }
    locationResults = firstPointWithLocation
  }

  res.json({ path: await aStarPathfinding(db, point, locationResults.rows[0].keyframe_id) ?? [] })
});

app.get('/point/:id/neighbours/:is_refined/:distance_thresh_m/:y_dist_thresh_m', async function (req, res) {
  const is_refined = Boolean(req.params.is_refined === 'true');
  const mainPointId = Number(req.params.id)

  const distanceThreshold = Number(req.params.distance_thresh_m);
  const yDistThresh = Number(req.params.y_dist_thresh_m);

  if (isNaN(mainPointId) || isNaN(distanceThreshold) || isNaN(yDistThresh)) {
    res.status(400).send("Invalid params").end();
    return;
  }

  // Fetch the initial point
  const { rows: [currentPoint] } = await db.query(
    `SELECT x_trans, y_trans, z_trans FROM ${is_refined ? "refined_" : ""}nodes WHERE keyframe_id = $1`,
    [mainPointId]
  );
  if (!currentPoint) {
    res.status(400).send("Point ID given does not exist!").end()
    return
  }

  res.json(await searchNeighbour(is_refined, mainPointId, distanceThreshold, yDistThresh, currentPoint))
})




app.get('/point/:id/:is_refined', async function (req: { params: { id: number, is_refined: string } }, res: { json: (arg0: any) => void }) {

  const is_refined = Boolean(req.params.is_refined == 'true');
  const rows = await db.query(`
    SELECT n.keyframe_id, n.ts, n.pose, l.location, n.label
    FROM ${is_refined ? "refined_" : ""}nodes n
    LEFT JOIN ${is_refined ? "refined_" : ""}node_locations l ON n.keyframe_id = l.keyframe_id
    WHERE n.keyframe_id = $1;
    `, [Number(req.params.id)]);

  res.json(rows.rows[0])
})

app.get('/floors', async function (req: any, res: any) {
  res.json((await db.query("SELECT DISTINCT location FROM refined_node_locations UNION SELECT DISTINCT label FROM refined_nodes WHERE label is not NULL AND label <> '';")).rows)
  // Some labels and floor names may be vulnerable to XSS
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
  const firstNodeWithLocation = await db.query("SELECT n.keyframe_id, l.location, n.label FROM refined_nodes n JOIN refined_node_locations l ON n.keyframe_id = l.keyframe_id WHERE l.location = $1 LIMIT 1", [req.params.floor])
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
			SELECT n.keyframe_id, n.ts, n.pose, n.label
			FROM ${is_refined ? "refined_" : ""}nodes n 
			JOIN ${is_refined ? "refined_" : ""}node_locations l ON l.name = n.location
			WHERE l.location = 
				(SELECT location FROM ${is_refined ? "refined_" : ""}nodes WHERE keyframe_id = $1)`, [id])
  res.json(rows.rows)
})

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


  if (SEND_TEST_IMAGE) {
    res.sendFile(path.join(KEYFRAME_IMG_DIR, "test.jpg"))
    console.log("Sending Test")
    return;
  }

  const imgPath = path.join(KEYFRAME_IMG_DIR, ts + KEYFRAME_IMG_EXTENSION)
  if (!imgPath) {
console.error("Could not find file", imgPath);
    res.sendStatus(404);
    return;
  }

  if (fs.existsSync(imgPath)) {

    processImage(res, imgPath, detail === "hires" ? 1920 : (detail === "lores" ? 960 : 200))
  }
  else {
    res.sendFile(path.join(KEYFRAME_IMG_DIR, "test.jpg"))
  }
})

app.use(floorplanAPI)

const port = 3001
app.listen(port, () => {
  initData(true)
  console.log(`Server running on port ${port}`)
})
