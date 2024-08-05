import db from "./db";
import * as THREE from 'three'


const SCALE_TO_METRES = 50

const calculatePositionFromMatrix = (matrix: number[]): [number, number, number] => {
  const m = new THREE.Matrix4();
  //@ts-ignore
  m.set(...matrix);
  m.invert();
  const position = new THREE.Vector3();
  position.setFromMatrixPosition(m);
  return [-position.x * SCALE_TO_METRES, -position.y * SCALE_TO_METRES, position.z * SCALE_TO_METRES];
};



async function prune() {

  await db.query("BEGIN")
  try {

  const firstId = (await db.query(
    "SELECT keyframe_id FROM nodes WHERE keyframe_id >= 0 LIMIT 1;"
  )).rows;
 
  // Get node next ID
  // WHILE get next node not empty

  let currentKeyframeId = firstId[0]["keyframe_id"];

  console.log("First keyframe ID", currentKeyframeId)

  let nextId = (
    await db.query(
      "SELECT keyframe_id, pose FROM nodes WHERE keyframe_id >= $1 LIMIT 1;",
      [currentKeyframeId]
    )
  ).rows[0];

  currentKeyframeId = nextId["keyframe_id"]
  let currentPosition = calculatePositionFromMatrix(nextId["pose"])

  console.log("Starting loop")
  while (currentKeyframeId != null) {
    // Note: Experiment with finding direct or covisibility neighbours
    console.log("Current: ", currentKeyframeId)
    const neighbours = await db.query(
      "SELECT keyframe_id1 FROM edges WHERE (keyframe_id0 = $1) AND is_direct = true;",
      [currentKeyframeId]
    );
    console.log("Neighbours", neighbours.rowCount)

    // Get neighbours
    // For neighbours of degree 1 or 2, find proximity
    // IF neighbour distance < 5, replace its edges with one pointing to new location

    for (const neighbour of neighbours.rows) {
      const neighbourId = neighbour["keyframe_id1"]

      const degrees = (await db.query(
        "SELECT keyframe_id1 FROM edges WHERE keyframe_id0 = $1 AND is_direct = true;",
        [neighbourId]
      )).rows;
      
      if (degrees.length === 0){
        throw Error("Could not find neighbour of ID " + neighbourId)
      }

      if (degrees.length > 2) {
        console.log("Id: ", neighbourId, "has degree of ", degrees.length, "skipping")
        // Ignore any points > degree 2
        continue;
      }

      const node = await db.query("SELECT pose FROM nodes WHERE keyframe_id = $1 LIMIT 1;", [neighbourId])

      if (node.rows && node.rows.length > 0){
        console.log(node.rows, node.rows[0])
        const position = calculatePositionFromMatrix(node.rows[0]["pose"])
        console.log(position)

        const dist = Math.sqrt(Math.pow( position[0] - currentPosition[0], 2) + Math.pow( position[2] - currentPosition[2], 2)) // Ignore Y (index 1) because we just want flat distance

        if (dist < 5){
          console.log("Deleting edge ", neighbourId, " distance is ", dist, " to currentId ", currentKeyframeId)
          db.query(`UPDATE Edges
                SET keyframe_id0 = CASE
                    WHEN keyframe_id0 = $1 THEN $2
                    ELSE keyframe_id0
                  END,
                    keyframe_id1 = CASE
                    WHEN keyframe_id1 = $1 THEN $2
                    ELSE keyframe_id1
                  END
                WHERE keyframe_id0 = $1 OR keyframe_id1 = $1 ON CONFLICT DO NOTHING;
            `, [neighbourId, currentKeyframeId])

          db.query("DELETE FROM nodes WHERE keyframe_id = $1;", [neighbourId])
          db.query("DELETE FROM edges WHERE (keyframe_id0 = $1 AND keyframe_id1 = $1) OR (keyframe_id0 = $2 OR keyframe_id1 = $2);", [currentKeyframeId, neighbourId]) // Remove duplicates
        }

      }
      else {
        console.log("No node found for id", neighbourId, "see:", node)
      }

      //    Fetch new location and check that one's distance
      //    WHILE new location distance < 5:
      //      Fetch
      //      Replace
    }

    // Move to next
    nextId = (
      await db.query(
        "SELECT keyframe_id, pose FROM nodes WHERE keyframe_id > $1 LIMIT 1",
        [currentKeyframeId]
      )
    ).rows;

    if (nextId.length == 0){
      console.log("No nextid exists at id", currentKeyframeId)
      break;
    }

    currentKeyframeId = nextId[0]["keyframe_id"]
    currentPosition = calculatePositionFromMatrix(nextId[0]["pose"])
  }
  console.log("Committing")
  await db.query("COMMIT")
}
catch (e){
  await db.query("ROLLBACK")
  console.log("Error", e)
}
}

// ELSE, skip

// Execute the function
prune();
