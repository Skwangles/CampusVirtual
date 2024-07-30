
import db from './db'

async function getFirstKeyframeId() {
  try {
    // Execute the query
    const result = await db.query('SELECT keyframe_id FROM nodes LIMIT 1');
    if (result.rows.length > 0) {
      // Log the first item
      console.log('First keyframe_id:', result.rows[0].keyframe_id);
    } else {
      console.log('No rows found.');
    }
  } catch (err) {
    console.error('Error executing query:', err.stack);
  }
}

// Execute the function
getFirstKeyframeId();