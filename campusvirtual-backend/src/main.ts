import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import express from 'express'

import db, { keyframes, video_timestamps } from './db'

const __filename = fileURLToPath(import.meta.url) // get the resolved path to the file
const __dirname = path.dirname(__filename) // get the name of the directory

const picturesDir = '/home/skwangles/Documents/Honours/CampusVirtual/pictures'

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.static(path.join(__dirname, '../ui/dist')))

// render browser
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
})

const send_test_image = true

const defaultPose = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]

app.get('/point/:id/neighbours/:depth', async function (req: { params: { id: any; depth: any } }, res: { json: (arg0: {}) => void }) {
  const main_point_id = req.params.id
  const neighbours_depth = req.params.depth
  // Fetch from Edges for keyframe_id0 = id and select keyframe_id1 - JOIN keyframe_id1 ON 

  const rows = await db.query(`
    SELECT k.id, k.ts, n.pose, e.is_direct
    FROM edges e
    JOIN nodes n ON e.keyframe_id1 = n.keyframe_id
    JOIN keyframes k ON e.keyframe_id1 = k.id
    WHERE e.keyframe_id0 = $1;
    `, [main_point_id]);
  
  console.log(rows)
  res.json(rows)
})

app.get('/point/:id', async function (req: { params: { id: any } }, res: { json: (arg0: any) => void }) {
  const info = await keyframes(db).findOne({ id: req.params.id })

  const video = await video_timestamps(db).findOne({
    start_ts: { $lte: info.ts },
    end_ts: { $gte: info.ts },
  })

  const rows = await db.query(`
    SELECT k.id, k.ts, n.pose, convert_from(vt.name, 'UTF-8')
    FROM nodes n
    JOIN keyframes k ON n.keyframe_id = k.id
    JOIN video_timestamps vt ON k.ts >= vt.start_ts AND k.ts <= vt.end_ts
    WHERE n.keyframe_id = $1;
    `, [req.params.id]);

  console.log(rows)
  res.json(rows)
})

app.get('/image/:id', function (req: { params: { id: any } }, res: { sendFile: (arg0: string) => void }) {
  const id = req.params.id

  res.sendFile('../pictures/test.jpg')
})

const port = 3001
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
