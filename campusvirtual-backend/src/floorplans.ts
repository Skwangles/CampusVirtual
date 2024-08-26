import express, { Router, Request, Response } from "express";
import db from './db'
const app = Router();

app.get('/api/floorplans/:name', async (req: Request, res: Response) => {
  const { name } = req.params;

  // Includes keyframes bordering the floor (add 'AND type < 50' to exclude)
  const pointResult = await db.query("SELECT keyframe_id, x, y, type FROM floorplan_points WHERE location = $1", [name]);
  const image = await db.query("SELECT path FROM floorplan_images WHERE location = $1 LIMIT 1;", [name])

  const edges = await db.query(`SELECT  e.keyframe_id0, e.keyframe_id1 FROM refined_edges e JOIN floorplan_points f ON e.keyframe_id0 = f.keyframe_id JOIN floorplan_points f2 ON e.keyframe_id1 = f2.keyframe_id WHERE f.location = $1 AND f2.location = $1`, [name])
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

export default app;