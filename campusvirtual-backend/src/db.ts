import createConnectionPool, { sql } from '@databases/pg'
import tables from '@databases/pg-typed'
import DatabaseSchema from './__generated__'

const dbConfig = {
  user: 'test',
  password: 'test',
  database: 'campusvirtual',
  host: 'localhost',
  port: 5432,
}

export { sql }

const db = createConnectionPool(dbConfig)
export default db

// You can list whatever tables you actually have here:
export const { keyframes, video_timestamps, associations, nodes, edges } =
  tables<DatabaseSchema>({
    databaseSchema: require('./__generated__/schema.json'),
  })
