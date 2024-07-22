import path from 'path'
import cors from 'cors'
import express from 'express'
import fs from 'fs'

import db from './db'

const picturesDir = '/home/skwangles/Documents/Honours/CampusVirtual/pictures/'

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.static(path.join(__dirname, '../ui/dist')))

// render browser
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
})

const send_test_image = false

app.get('/point/:id/neighbours/:depth', async function (req, res) {
  const main_point_id = req.params.id
  const neighbours_depth = req.params.depth

  const rows = await db.query(`
    WITH RECURSIVE neighbours AS (
      SELECT 
        e.keyframe_id0 AS start_id,
        e.keyframe_id1 AS keyframe_id,
        n.ts,
        n.pose,
        1 AS depth
      FROM edges e
      JOIN nodes n ON e.keyframe_id1 = n.keyframe_id
      WHERE e.keyframe_id0 = $1
      UNION ALL
      SELECT 
        n1.start_id,
        e.keyframe_id1,
        n2.ts,
        n2.pose,
        n1.depth + 1
      FROM neighbours n1
      JOIN edges e ON e.keyframe_id0 = n1.keyframe_id
      JOIN nodes n2 ON e.keyframe_id1 = n2.keyframe_id
      WHERE n1.depth < $2
    )
    SELECT DISTINCT keyframe_id, ts, pose
    FROM neighbours WHERE keyframe_id <> $1;
    `, [main_point_id, neighbours_depth]);

  res.json(rows.rows)
})

app.get('/point/:id/neighbours', async function (req: { params: { id: any; depth: any } }, res: { json: (arg0: {}) => void }) {
  const main_point_id = req.params.id
  const neighbours_depth = req.params.depth
  // Fetch from Edges for keyframe_id0 = id and select keyframe_id1 - JOIN keyframe_id1 ON 

  const rows = await db.query(`
    SELECT n.keyframe_id, n.ts, n.pose, e.is_direct
    FROM edges e
    JOIN nodes n ON e.keyframe_id1 = n.keyframe_id
    WHERE e.keyframe_id0 = $1;
    `, [main_point_id]);

  res.json(rows.rows)
})

app.get('/point/:id', async function (req: { params: { id: any } }, res: { json: (arg0: any) => void }) {
  const rows = await db.query(`
    SELECT n.keyframe_id, n.ts, n.pose, l.location
    FROM nodes n
    LEFT JOIN node_locations l ON n.keyframe_id = l.keyframe_id
    WHERE n.keyframe_id = $1;
    `, [req.params.id]);

    //, convert_from(vt.name, 'UTF-8')
// JOIN video_timestamps vt ON n.ts >= vt.start_ts AND n.ts <= vt.end_ts
  res.json(rows.rows[0])
})

app.get('/image/:ts', function (req: { params: { ts: any } }, res: { sendFile: (arg0: string) => void }) {
  const ts = req.params.ts



  if (send_test_image){
    res.sendFile(picturesDir + "test.jpg");
    console.log("Sending Test")
    return;
  }


  let [date, ms] = String(ts).split(".")

  // Handle quirk with timestamp saving where last number rounds up 
  const main_path = picturesDir + date + "." + ms.slice(0,5) + ".png"
  const rounded_up_path = picturesDir + date + "." + ms.slice(0,4) + (Number(ms[4]) + 1) + ".png"

  if (fs.existsSync(main_path)){
    res.sendFile(main_path)
  }
  else if (fs.existsSync(rounded_up_path)){
  res.sendFile(rounded_up_path)  
  }
  else {
    res.sendFile(picturesDir + "test.jpg")
  }
})

const port = 3001
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
