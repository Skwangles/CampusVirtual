import Pool  from 'pg-pool'

const dbConfig = {
  user: 'campusvirtual',
  password: 'Squeegee-Grandkid-Superhero8',
  database: 'cv',
  host: 'localhost',
  port: 5432,
}

const db = new Pool(dbConfig)
export default db

