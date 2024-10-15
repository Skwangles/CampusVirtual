import Pool from 'pg-pool'
import path from 'path'
import fs from 'fs'
const dbConfig = {
  user: 'campusvirtual',
  password: 'Squeegee-Grandkid-Superhero8',
  database: 'cv',
  host: 'localhost',
  port: 5432,
}

const db = new Pool(dbConfig)

const count = 5;

const directory = "/media/skwangles/KINGSTON/MEDIA/blurredPhotos/"
const output = "/media/skwangles/KINGSTON/MEDIA/EDS-Images/"

async function copyFileIfExists(file) {
  const filePath = path.join(directory, Number(file).toFixed(5) + ".png");
  const outputPath = path.join(output, Number(file).toFixed(5) + ".png");
  console.log(filePath, "to", outputPath);
  if (fs.existsSync(filePath) && !fs.existsSync(outputPath)) {
    await fs.promises.copyFile(filePath, outputPath);
  }
}

async function start() {
  const result = await db.query("SELECT ts FROM refined_nodes");
  const rows = result.rows;

  for (let i = 0; i < rows.length; i += count) {
    const batch = rows.slice(i, i + count);
    await Promise.all(batch.map(row => copyFileIfExists(row.ts)));
  }
}

start().catch(console.error);