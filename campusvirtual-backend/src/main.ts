import path from 'path'
import cors from 'cors'
import express from 'express'

import db from './db'

const picturesDir = '/home/skwangles/Documents/Honours/CampusVirtual/pictures/'

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.static(path.join(__dirname, '../ui/dist')))

// render browser
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
})

const send_test_image = true

const defaultPose = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]

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
  
  console.log(rows.rows)
  res.json(rows.rows)
})

app.get('/point/:id', async function (req: { params: { id: any } }, res: { json: (arg0: any) => void }) {
  const rows = await db.query(`
    SELECT n.keyframe_id, n.ts, n.pose
    FROM nodes n
    WHERE n.keyframe_id = $1;
    `, [req.params.id]);

    //, convert_from(vt.name, 'UTF-8')
// JOIN video_timestamps vt ON n.ts >= vt.start_ts AND n.ts <= vt.end_ts
  console.log(rows.rows)
  res.json(rows.rows[0])
})

app.get('/image/:ts', function (req: { params: { ts: any } }, res: { sendFile: (arg0: string) => void }) {
  const ts = req.params.ts

  let [date, ms] = String(ts).split(".")

  res.sendFile(picturesDir + date + "." + ms.slice(0,5) + ".png")
  // res.sendFile(picturesDir + "test.jpg");
})

const port = 3001
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
