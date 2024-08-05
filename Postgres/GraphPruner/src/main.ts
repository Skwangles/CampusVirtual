import db from "./db";

async function getFirstKeyframeId() {
  try {
    // Execute the query
    const result = await db.query("SELECT keyframe_id FROM nodes LIMIT 1");
    if (result.rows.length > 0) {
      // Log the first item
      console.log("First keyframe_id:", result.rows[0].keyframe_id);
    } else {
      console.log("No rows found.");
    }
  } catch (err) {
    console.error("Error executing query:", err);
  }
}

async function prune() {
  const firstId = await db.exec(
    "SELECT keyframe_id FROM nodes WHERE keyframe_id >= 0 LIMIT 1"
  );

  const firstKeyframeId = firstId.rows[0][0];
  // Get node next ID
  // WHILE get next node not empty

  let currentKeyframeId = firstKeyframeId;
  let nextId = (
    await db.exec(
      "SELECT keyframe_id FROM nodes WHERE keyframe_id >= $1 LIMIT 1",
      currentKeyframeId
    )
  ).rows;
  while (nextId.length > 0 && nextId) {
    // Note: Experiment with finding direct or covisibility neighbours
    const neighbours = await db.exec_params(
      "SELECT keyframe_id1 FROM edges WHERE (keyframe_id0 = $1) AND is_direct = true",
      firstKeyframeId
    );

    // Get neighbours
    // For neighbours of degree 1 or 2, find proximity
    // IF neighbour distance < 5, replace its edges with one pointing to new location

    for (const neighbour of neighbours.rows) {
      const neighbourId =
        neighbour[0] == currentKeyframeId ? neighbour[1] : neighbour[0];

      const neighbour_degree_rows = await db.exec_params(
        "SELECT id FROM edges WHERE (keyframe_id0 = $1 OR keyframe_id1 = $1) AND is_direct = true",
        neighbourId
      );
      if (neighbour_degree_rows.rows.length > 2) {
        continue;
      }

      //    Fetch new location and check that one's distance
      //    WHILE new location distance < 5:
      //      Fetch
      //      Replace
    }
  }
}

// ELSE, skip

// Execute the function
getFirstKeyframeId();
