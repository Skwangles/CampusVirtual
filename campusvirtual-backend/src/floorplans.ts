import express, { Router, Request, Response } from "express";
import db from './db'
import path from "path";
import multer from "multer";
import fs from 'fs'
import { SEND_TEST_IMAGE, FLOORPLAN_IMAGE_DIR, KEYFRAME_IMG_DIR, KEYFRAME_IMG_EXTENSION } from './consts'
import { stripDirectoryTraversal } from './utils'
const app = Router();

app.use(express.static(path.join(__dirname, '../../authoring/dist')))

app.get('/authoring', function (req, res) {
  res.sendFile(path.join(__dirname, '../../authoring/dist', 'index.html'))
});

// Configure Multer for file upload handling
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: (arg0: null, arg1: string) => void) => {
    // Ensure the uploads directory exists
    const uploadDir = FLOORPLAN_IMAGE_DIR;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file: { originalname: any; }, cb: (arg0: null, arg1: any) => void) => {
    // Use the original filename
    cb(null, file.originalname);
  },
});

const upload = multer({ storage })

app.post('/api/floorplans/:name/image', upload.single('file'), async (req: any, res) => {
  try {
    const { name } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).send('No file uploaded.');
    }

    // Save the image path to the database
    const filePath = file.filename;
    await db.query('UPDATE floorplan_images SET path = $1 WHERE location = $2', [filePath, name]);

    res.send('File uploaded and path updated successfully.');
  } catch (error) {
    console.error('Error handling file upload:', error);
    res.status(500).send('Internal server error.');
  }
});

app.post('/api/floorplans/:name/update', (req: Request, res: Response) => {
  const { name } = req.params;
  const { id, x, y } = req.body;

  db.query("UPDATE floorplan_points SET x = $1, y = $2 WHERE keyframe_id = $3 AND location = $4;", [x, y, id, name]).then(
    (val: any) => {
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

app.get('/api/image/:id', async function (req: { params: { id: number } }, res) {
  const id = Number(req.params.id);

  // Using FROM nodes because its the superset
  const result = await db.query("SELECT ts FROM nodes WHERE keyframe_id = $1", [id])
  if (!result || result.rowCount == 0) {
    res.sendStatus(404);
    return;
  }

  const ts = Number(result.rows[0].ts).toFixed(5);
  if (ts === "NaN") {
    res.status(400).send("Image id was not a valid image ID")
    return;
  }

  if (SEND_TEST_IMAGE) {
    res.sendFile(path.join(KEYFRAME_IMG_DIR, "test.jpg"));
    console.log("Sending Test")
    return;
  }
  const pathString = stripDirectoryTraversal(path.join(KEYFRAME_IMG_DIR, Number(ts).toFixed(5).toString() + KEYFRAME_IMG_EXTENSION), KEYFRAME_IMG_DIR);
  if (!pathString) {
    res.sendStatus(404);
    return; // Potential directory traversal attack
  }

  if (fs.existsSync(pathString)) {
    res.sendFile(pathString)
  }
  else {
    res.sendFile(path.join(KEYFRAME_IMG_DIR, "test.jpg"))
  }
})

app.get('/api/floorplan/:name/image', async function (req: { params: { name: string } }, res) {
  const name = Number(req.params.name);

  // Using FROM nodes because its the superset
  const result = await db.query("SELECT path FROM floorplan_images WHERE location = $1", [name])
  if (!result || result.rowCount == 0) {
    res.sendStatus(404);
    return;
  }


  const pathString = stripDirectoryTraversal(path.join(FLOORPLAN_IMAGE_DIR, String(result.rows[0].path)), FLOORPLAN_IMAGE_DIR);
  if (!pathString) {
    res.sendStatus(404); // Potential directory traversal attack found
    return;
  }

  if (fs.existsSync(pathString)) {
    res.sendFile(pathString)
  }
  else {
    res.sendFile(path.join(KEYFRAME_IMG_DIR, "test.jpg"))
  }
})

export default app;