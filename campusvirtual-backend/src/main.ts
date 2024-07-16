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

app.get('/point/:id/neighbours/:depth', function (req, res) {
  const main_point_id = req.params.id
  const neighbours_depth = req.params.depth

  res.json({
    neighbours: [
      {
        id: 1,
        pose: defaultPose,
        timestamp: 0,
        x: 0,
        y: 10,
        z: 10,
      },
      {
        id: 2,
        pose: defaultPose,
        timestamp: 0,
        x: 0,
        y: 0,
        z: 14,
      },
      {
        id: 3,
        pose: defaultPose,
        timestamp: 0,
        x: 0,
        y: 10,
        z: 20,
      },
    ],
  })
})

app.get('/point/:id', async function (req, res) {
  const info = await keyframes(db).findOne({ id: req.params.id })

  const video = await video_timestamps(db).findOne({
    start_ts: { $lte: info.ts },
    end_ts: { $gte: info.ts },
  })

  res.json({
    ...info,
    video_name: video.name,
  })
})

app.get('/image/:id', function (req, res) {
  const id = req.params.id

  res.sendFile('../pictures/test.jpg')
})

const port = 3001
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
