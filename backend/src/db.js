const { Pool } = require('pg');
require('dotenv').config();

// Local testing without a Postgres server: USE_PG_MEM=1 runs the same
// SQL against an in-memory Postgres emulator (devDependency pg-mem).
// Production / Docker always uses a real PostgreSQL via DATABASE_URL.
let pool;
if (process.env.USE_PG_MEM === '1') {
  const { newDb } = require('pg-mem');
  const db = newDb();
  const { Pool: MemPool } = db.adapters.createPg();
  pool = new MemPool();
} else {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://joineazy:joineazy@localhost:5432/joineazy',
  });
}

module.exports = pool;
