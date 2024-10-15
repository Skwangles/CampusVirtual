const { spawn } = require("node:child_process");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const db = require("./db.js")
const useRefined = true;
const picturesDir = "/home/skwangles/Documents/Honours/CampusVirtual/pictures";

let express = require("express");
let app = express();

// setting express

app.use(cors({ origin: "*" }));
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));

// render browser
app.get("/", function (req, res) {
  res.render("index.ejs");
});

const send_test_image = false;


app.get('/points/', async function (req, res) {
  const rows = await db.query(`
    SELECT keyframe_id, ts, pose
    FROM ${useRefined ? "refined_" : ""}nodes n;
    `);

  console.log(rows.rowCount)
  res.json(rows.rows)
})



app.get("/image/:id", async function (req, res) {
  const id = req.params.id;

  if (send_test_image) {
    const output = picturesDir + "/test.png";
    res.sendFile(output);
    return;
  }

  console.log(id);

  const rows = await db.query(`SELECT ts FROM ${useRefined ? "refined_" : ""}nodes WHERE keyframe_id = $1;`,
    [id]);

  const ts = rows.rows[0].ts


  const output = picturesDir + "/" + Number(ts).toFixed(5) + ".jpg";
  console.log(output);

  if (fs.existsSync(output)) {
    // Send already generated image
    res.sendFile(output);
    console.log("Image already exists for ID " + id + " @ " + output);
    return;
  }

});


app.get('/edges/:direct', async function (req, res) {
  const rows = await db.query(`
    SELECT keyframe_id0, keyframe_id1, type FROM ${useRefined ? "refined_" : ""}edges
    WHERE type = $1;
    `, [req.params.direct]);

  res.json(rows.rows)
})

app.get('/edges', async function (req, res) {
  const rows = await db.query(`
    SELECT keyframe_id0, keyframe_id1, type FROM ${useRefined ? "refined_" : ""}edges
    WHERE type = 0 OR type = 1;
    `);

  res.json(rows.rows)
})


const port = 3003;
app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
