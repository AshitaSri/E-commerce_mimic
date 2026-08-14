const { Pool } = require('pg');

async function openDb(databaseName, schemaSql) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgres://app:app@localhost:5432/${databaseName}`,
  });
  if (schemaSql) await pool.query(schemaSql);
  return pool;
}

module.exports = { openDb };
