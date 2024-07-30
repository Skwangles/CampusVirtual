import Pool  from 'pg-pool'

const dbConfig = {
  user: 'test',
  password: 'test',
  database: 'campusvirtual',
  host: 'localhost',
  port: 5432,
}

const db = new Pool(dbConfig)
export default db

