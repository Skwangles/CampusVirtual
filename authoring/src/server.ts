import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
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
      { id: 'node1', x: 10, y: 20 },
      { id: 'node2', x: 30, y: 40 },
    ]
  },
  // Add other floorplans here
};

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
})


app.get('/api/floorplans', (req: Request, res: Response) => {
  res.json(Object.keys(floorplans));
});

app.get('/api/floorplans/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  if (floorplans[name]) {
    res.json(floorplans[name]);
  } else {
    res.status(404).send('Floorplan not found');
  }
});

app.post('/api/floorplans/:name/update', (req: Request, res: Response) => {
  const { name } = req.params;
  const { id, x, y } = req.body;

  if (floorplans[name]) {
    const node = floorplans[name].nodes.find((node: any) => node.id === id);
    if (node) {
      node.x = x;
      node.y = y;
      res.sendStatus(200);
    } else {
      res.status(404).send('Node not found');
    }
  } else {
    res.status(404).send('Floorplan not found');
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
